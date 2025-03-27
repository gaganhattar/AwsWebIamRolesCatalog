#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { VpcNetworkStack } from '../lib/vpc-network-stack';
import { FrontendS3Stack } from '../lib/frontend-s3-stack';
import { FrontendComputeStack } from '../lib/frontend-compute-stack';
import { FrontendAcmRoute53Stack } from '../lib/frontend-acm-route53-stack';
import { FrontendCloudFrontStack } from '../lib/frontend-cloudfront-stack';

const app = new cdk.App();

// 1. Create the VPC and networking resources
const vpcStack = new VpcNetworkStack(app, 'VpcNetworkStack', { env });

// Step 2: Static S3 bucket for frontend assets
// Retrieve bucket name from context or fallback
const bucketName = app.node.tryGetContext('bucketName') || 'frontend-default-bucket';
const s3Stack = new FrontendS3Stack(app, 'FrontendS3Stack', {
  bucketName: bucketName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
// Create ACM/Route53 stack
const acmStack = new FrontendAcmRoute53Stack(app, 'FrontendAcmRoute53Stack', {
  domainName: 'yourdomain.com',
  subdomain: 'www',
  distribution: undefined as any, // temporarily placeholder
});

// Step 3: Compute stack with ASG, EC2, and NAT-backed subnet
new FrontendComputeStack(app, 'FrontendComputeStack', vpcStack.vpc, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});

// Step 4: ACM + Route53 stack (requires CloudFront distribution)
const cloudfrontDistribution = cloudfront.Distribution.fromDistributionAttributes(app, 'ImportedDistribution', {
  distributionId: 'YOUR_DIST_ID',
  domainName: 'd123abc.cloudfront.net',
});

const FrontEnd = new FrontendAcmRoute53Stack(app, 'FrontendAcmRoute53Stack', {
  domainName: 'yourdomain.com',
  subdomain: 'www',
  distribution: cloudfrontDistribution,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});

const cloudfrontStack = new FrontendCloudFrontStack(app, 'FrontendCloudFrontStack', {
  siteBucket: s3Stack.siteBucket,
  loadBalancer: computeStack.loadBalancer,
  acmCertificateArn: acmRouteStack.certificate.certificateArn,
  domainName: 'yourdomain.com',
  subdomain: 'www',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  }
});

cloudfrontStack.addDependency(computeStack);
cloudfrontStack.addDependency(acmRouteStack);
cloudfrontStack.addDependency(s3Stack);
