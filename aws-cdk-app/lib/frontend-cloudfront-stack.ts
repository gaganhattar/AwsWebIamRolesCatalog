// lib/frontend-cloudfront-stack.ts
/**
 * File: frontend-cloudfront-stack.ts
 * Date: 2025-03-27
 * Author: Gaganjit Singh Hattar
 * Description: Defines a CDN for webapp of  frontend infrastructure
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
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { FrontendSecurityStack } from './frontend-security-stack';
import { Construct } from 'constructs';

interface FrontendCloudFrontProps extends cdk.StackProps {
  siteBucket: s3.IBucket;
  loadBalancer: elbv2.IApplicationLoadBalancer;
  acmCertificateArn: string;
  domainName: string;
  subdomain: string;
}

export class FrontendCloudFrontStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly logBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendCloudFrontProps) {
    super(scope, id, props);

    // ========================
    // CLOUDFRONT LOG BUCKET
    // ========================
    // This S3 bucket receives access logs from CloudFront
    // *** CloudFront does not natively support CloudWatch Logs ***
    this.logBucket = new s3.Bucket(this, 'CloudFrontAccessLogBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // Create CloudFront distribution with S3 as default origin and ALB as additional route
    this.distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        // Serve static content from S3
        origin: new origins.S3Origin(props.siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        'api/*': {
          // Serve dynamic content via ALB for '/api/*' path
          origin: new origins.LoadBalancerV2Origin(props.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      domainNames: [`${props.subdomain}.${props.domainName}`],
      certificate: cloudfront.ViewerCertificate.fromAcmCertificate({
        certificateArn: props.acmCertificateArn,
        env: { region: 'us-east-1' },
        node: this.node
      }),
      comment: 'CloudFront distribution for frontend site with TLS and dual origin routing',
      enableLogging: true,
      logBucket: this.logBucket,
      logFilePrefix: 'cloudfront-access-logs/',
      comment: 'CloudFront Distribution for Frontend Static and API Routing',
    });
  }
}