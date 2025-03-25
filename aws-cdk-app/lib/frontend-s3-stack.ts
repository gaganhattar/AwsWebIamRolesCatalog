// lib/frontend-s3-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class FrontendS3Stack extends cdk.Stack {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, 'FrontendAssetsBucket', {
  bucketName: 'frontend-team-assets',
  versioned: true,
  publicReadAccess: false,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  enforceSSL: true,
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