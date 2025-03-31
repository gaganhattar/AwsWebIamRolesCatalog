// lib/products/frontend-dev-product.ts
import * as cdk from 'aws-cdk-lib';
import * as servicecatalog from 'aws-cdk-lib/aws-servicecatalog';
import { Construct } from 'constructs';
import { FrontendS3Stack } from '../frontend-s3-stack';
import { FrontendComputeStack } from '../frontend-compute-stack';
import { FrontendAcmRoute53Stack } from '../frontend-acm-route53-stack';
import { FrontendCloudFrontStack } from '../frontend-cloudfront-stack';
import { FrontendSecurityStack } from '../frontend-security-stack';
import { AthenaQueryStack } from '../Athena-query-stack';

/**
 * =========================
 * Service Catalog Product: Frontend Dev Infrastructure
 * =========================
 *
 * This Service Catalog product provisions:
 * - S3 bucket for static site hosting
 * - CloudFront distribution
 * - EC2 ASG with ALB
 * - ACM certificate + Route 53 records
 * - Logging Support for deployed resources
 *
 * Note: These stacks assumes no foundational VPC and security setup present in the account.
 */
export class FrontendDevProduct extends servicecatalog.CloudFormationProduct {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      productName: 'Frontend Dev Infrastructure',
      owner: 'Platform Admin',
      distributor: 'Self-Service Portal',
      description: 'Provision S3 + CloudFront + Compute + ACM + DNS for frontend this',
      cloudFormationTemplate: servicecatalog.CloudFormationTemplate.fromProductStack(
        new FrontendProductStack(scope, 'FrontendProductStack')
      )
    });
  }
}

/**
 * This stack bundles all required infra for the frontend web product.
 */
class FrontendProductStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const env = {
      account: process.env.CDK_DEFAULT_ACCOUNT, //CDK will get this from ~/.aws/credentials
      region: process.env.CDK_DEFAULT_REGION //CDK will get this from ~/.aws/credentials};
    };

   //  1. Static S3 bucket for frontend assets
    // Retrieve bucket name from context or fallback
    const bucketName = this.node.tryGetContext('bucketName') || 'frontend-default-bucket';
    const s3Stack = new FrontendS3Stack(this, 'FrontendS3Stack', {
      bucketName: bucketName,
      env,
    });

    // 2. ACM + Route53 stack (Certificate and DNS)
    // Retrieve bucket name from context or fallback
    const domainName = this.node.tryGetContext('domainName');
    if (!domainName) {
      throw new Error("Missing required context: domainName. Pass it via --context or cdk.json");
    }
    const acmRoute53Stack = new FrontendAcmRoute53Stack(this, 'FrontendAcmRoute53Stack', {
      domainName: domainName,
      subdomain: 'www',
      distribution: undefined as any, // placeholder to be set after CloudFront stack
      env
    });
    
    // 3. CloudFront stack (uses S3 + ACM)
    const cloudfrontStack = new FrontendCloudFrontStack(this, 'FrontendCloudFrontStack', {
      siteBucket: s3Stack.bucket,
      acmCertificateArn: acmRoute53Stack.certificate.certificateArn,
      domainName: domainName,
      subdomain: 'www',
      loadBalancer: undefined as any, // placeholder to be set after compute stack
      env
    });
    
    // 4. Compute stack (ALB, ASG, EC2, dynamic content, SG based on CloudFront IPs)
    const computeStack = new FrontendComputeStack(this, 'FrontendComputeStack', vpcStack.vpc, {
      env
    });
    
    // Update CloudFrontStack with load balancer (after compute stack is created)
    cloudfrontStack.distribution.node.addDependency(computeStack);
    cloudfrontStack.distribution.node.tryRemoveChild('Resource');
    
    // 5. Reconnect distribution into Route53 stack for alias
    acmRoute53Stack.distribution = cloudfrontStack.distribution;
    
    // 6. Security stack: adds WAF protection to CloudFront with logging
    new FrontendSecurityStack(this, 'FrontendSecurityStack', {
      cloudfrontDistribution: cloudfrontStack.distribution,
      env
    });
    
    // 7. Athena stack to query logs from both CloudFront and S3
    new AthenaQueryStack(this, 'AthenaQueryStack', {
      env,
      logsBucket: cloudfrontStack.logBucket, // assumes shared bucket for simplicity
      cloudfrontPrefix: 'cloudfront-access-logs/',
      s3AccessPrefix: 'frontend-access-logs/',
    });
  }
}


/**
 * This function should be invoked in your Service Catalog stack (e.g., FrontendServiceCatalogStack)
 * to wire this product to the SC portfolio with IAM role access.
 */
export function addFrontendDevProductToPortfolio(scope: Construct, portfolio: servicecatalog.Portfolio) {
   const product = new FrontendDevProduct(scope, 'FrontendDevProduct');
   portfolio.addProduct(product);
 } 