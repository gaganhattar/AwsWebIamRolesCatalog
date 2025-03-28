// lib/frontend-s3-stack.ts
/**
 * File: rontend-s3-stack.ts
 * Date: 2025-03-27
 * Author: Gaganjit Singh Hattar
 * Description: Defines a Site Bucket for static content of frontend infrastructure
 * 
 * Change History:
 * -----------------------------------------------------------------------------
 * Date         | Author                 | Description
 * -----------------------------------------------------------------------------
 * 2025-03-27   | Gaganjit Singh Hattar  | Initial creation of CDK app structure
 * -----------------------------------------------------------------------------
 * 
 * © 2025 Gaganjit Singh Hattar. All rights reserved.
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';

export class FrontendS3Stack extends cdk.Stack {
   public readonly bucket: s3.Bucket;
   public readonly accessLogsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
  super(scope, id, props);

   // ========================
   // S3 ACCESS LOG BUCKET
   // ========================
   // This bucket stores access logs from the main S3 bucket
   this.accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
         {
            expiration: cdk.Duration.days(90),
         },
      ],
   });
   // ========================
   // CLOUDWATCH LOG GROUP (OPTIONAL)
   // ========================
   // CloudWatch cannot directly receive S3 access logs. Access logs go to S3 buckets.
   // If you use AWS Athena or Lambda to process logs, you may forward them to CloudWatch.
   // Here we define a log group that can be used for related logging (e.g. asset sync Lambda, custom processors).
   new logs.LogGroup(this, 'FrontendS3OperationsLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
   });

    // ========================
    // S3 BUCKET FOR STATIC SITE CONTENT
    // ========================
   this.bucket = new s3.Bucket(this, 'FrontendAssetsBucket', {
      bucketName: 'frontend-team-assets',
      versioned: true,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'frontend-access-logs/',
      lifecycleRules: [
         {
            transitions: [
            {
               storageClass: s3.StorageClass.GLACIER,
               transitionAfter: cdk.Duration.days(90)
            }
            ],
            expiration: cdk.Duration.days(365),
            id: 'ArchiveOldAssets'
         }
      ]
   });

   // Optional: Add bucket policy for IAM role-based access
   this.bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'FrontendTeamReadWriteAccess',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ArnPrincipal('arn:aws:iam::123456789012:role/FrontendS3AccessRole')],
      actions: [
         's3:GetObject',
         's3:PutObject',
         's3:ListBucket'
      ],
      resources: [
         this.bucket.bucketArn,
         `${this.bucket.bucketArn}/*`
      ]
   }));

  }
}