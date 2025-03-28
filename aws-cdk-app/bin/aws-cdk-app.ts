#!/usr/bin/env node
/**
 * File: app.ts
 * Date: 2025-03-27
 * Author: Gaganjit Singh Hattar
 * Description: Entry point for the CDK application to provision frontend infrastructure stacks including VPC, S3, ACM, Route 53, and CloudFront.
 * 
 * Change History:
 * -----------------------------------------------------------------------------
 * Date         | Author                 | Description
 * -----------------------------------------------------------------------------
 * 2025-03-25   | Gaganjit Singh Hattar  | Initial creation of CDK app structure
 * -----------------------------------------------------------------------------
 * 
 * © 2025 Gaganjit Singh Hattar. All rights reserved.
 */

import * as cdk from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { VpcNetworkStack } from '../lib/vpc-network-stack';
import { FrontendS3Stack } from '../lib/frontend-s3-stack';
import { FrontendComputeStack } from '../lib/frontend-compute-stack';
import { FrontendAcmRoute53Stack } from '../lib/frontend-acm-route53-stack';
import { FrontendCloudFrontStack } from '../lib/frontend-cloudfront-stack';
import { FrontendSecurityStack } from '../lib/frontend-security-stack';
import { AthenaQueryStack } from '../lib/Athena-query-stack';


const app = new cdk.App();
let env = {};
// 1. Create the VPC and networking resources
const vpcStack = new VpcNetworkStack(app, 'VpcNetworkStack', { env });

// Step 2: Static S3 bucket for frontend assets
// Retrieve bucket name from context or fallback
const bucketName = app.node.tryGetContext('bucketName') || 'frontend-default-bucket';
const s3Stack = new FrontendS3Stack(app, 'FrontendS3Stack', {
  bucketName: bucketName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, //CDK will get this from ~/.aws/credentials
    region: process.env.CDK_DEFAULT_REGION //CDK will get this from ~/.aws/credentials
  }
});
// 3. ACM + Route53 stack (Certificate and DNS)
const acmRoute53Stack = new FrontendAcmRoute53Stack(app, 'FrontendAcmRoute53Stack', {
  domainName: 'yourdomain.com',
  subdomain: 'www',
  distribution: undefined as any, // placeholder to be set after CloudFront stack
  env
});

// 4. CloudFront stack (uses S3 + ACM)
const cloudfrontStack = new FrontendCloudFrontStack(app, 'FrontendCloudFrontStack', {
  siteBucket: s3Stack.bucket,
  acmCertificateArn: acmRoute53Stack.certificate.certificateArn,
  domainName: 'yourdomain.com',
  subdomain: 'www',
  loadBalancer: undefined as any, // placeholder to be set after compute stack
  env
});

// 5. Compute stack (ALB, ASG, EC2, dynamic content, SG based on CloudFront IPs)
const computeStack = new FrontendComputeStack(app, 'FrontendComputeStack', vpcStack.vpc, {
  env
});

// Update CloudFrontStack with load balancer (after compute stack is created)
cloudfrontStack.distribution.node.addDependency(computeStack);
cloudfrontStack.distribution.node.tryRemoveChild('Resource');

// 6. Reconnect distribution into Route53 stack for alias
acmRoute53Stack.distribution = cloudfrontStack.distribution;

// 7. Security stack: adds WAF protection to CloudFront with logging
new FrontendSecurityStack(app, 'FrontendSecurityStack', {
  cloudfrontDistribution: cloudfrontStack.distribution,
  env
});

// 8. Athena stack to query logs from both CloudFront and S3
new AthenaQueryStack(app, 'AthenaQueryStack', {
  env,
  logsBucket: cloudfrontStack.logBucket, // assumes shared bucket for simplicity
  cloudfrontPrefix: 'cloudfront-access-logs/',
  s3AccessPrefix: 'frontend-access-logs/',
});