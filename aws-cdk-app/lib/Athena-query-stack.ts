// lib/athena-query-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface AthenaQueryStackProps extends cdk.StackProps {
  logsBucket: s3.Bucket;
  cloudfrontPrefix: string;
  s3AccessPrefix: string;
}

export class AthenaQueryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AthenaQueryStackProps) {
    super(scope, id, props);

    // ========================
    // GLUE DATABASE FOR ATHENA
    // ========================
    const glueDb = new glue.CfnDatabase(this, 'FrontendLogsDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'frontend_logs_db',
      },
    });

    // ========================
    // ATHENA WORKGROUP
    // ========================
    const workgroup = new athena.CfnWorkGroup(this, 'FrontendAthenaWorkgroup', {
      name: 'frontend_logs_wg',
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: `s3://${props.logsBucket.bucketName}/athena-results/`,
        },
      },
      state: 'ENABLED',
    });

    // ========================
    // IAM ROLE FOR GLUE CRAWLER
    // ========================
    const crawlerRole = new iam.Role(this, 'GlueCrawlerRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });

    props.logsBucket.grantRead(crawlerRole); // Grant read access to logs bucket

    // ========================
    // GLUE CRAWLER FOR CLOUDFRONT LOGS
    // ========================
    new glue.CfnCrawler(this, 'CloudFrontLogCrawler', {
      role: crawlerRole.roleArn,
      databaseName: glueDb.databaseInput.name!,
      targets: {
        s3Targets: [
          { path: `s3://${props.logsBucket.bucketName}/${props.cloudfrontPrefix}` },
        ],
      },
      name: 'cloudfront_log_crawler',
      tablePrefix: 'cf_',
      schedule: {
        scheduleExpression: 'cron(0 * * * ? *)' // every hour
      },
    });

    // ========================
    // GLUE CRAWLER FOR S3 ACCESS LOGS
    // ========================
    new glue.CfnCrawler(this, 'S3AccessLogCrawler', {
      role: crawlerRole.roleArn,
      databaseName: glueDb.databaseInput.name!,
      targets: {
        s3Targets: [
          { path: `s3://${props.logsBucket.bucketName}/${props.s3AccessPrefix}` },
        ],
      },
      name: 's3_access_log_crawler',
      tablePrefix: 's3_',
      schedule: {
        scheduleExpression: 'cron(30 * * * ? *)' // every hour at 30 min
      },
    });

    // ========================
    // OUTPUT AND NOTES
    // ========================
    new cdk.CfnOutput(this, 'AthenaSetupNote', {
      value: 'Glue Crawlers created for CloudFront and S3 access logs. Athena is ready to query.',
      description: 'You can use frontend_logs_db in Athena Console to explore the logs.',
    });

    // Notes:
    // - Crawlers automatically discover schema and create Athena-compatible tables.
    // - Make sure the logs are stored in correct prefixes: cloudfront-access-logs/, frontend-access-logs/
    // - Modify the crawler schedule if needed.
  }
}
