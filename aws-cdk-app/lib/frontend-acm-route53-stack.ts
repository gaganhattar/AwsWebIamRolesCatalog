// lib/frontend-acm-route53-stack.ts
/**
 * File: frontend-acm-route53-stack.ts
 * Date: 2025-03-27
 * Author: Gaganjit Singh Hattar
 * Description: Defines Cert and DNS for webapp hosted on frontend infrastructure
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
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

interface FrontendAcmRoute53Props extends cdk.StackProps {
  domainName: string;
  subdomain: string;
  distribution: cloudfront.IDistribution;
}

export class FrontendAcmRoute53Stack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: FrontendAcmRoute53Props) {
    super(scope, id, props);
   
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName,
    });

    this.certificate = new acm.Certificate(this, 'FrontendCert', {
      domainName: `${props.subdomain}.${props.domainName}`,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: props.subdomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(props.distribution)
      )
    });
  }

   // Notes:
   // - DNS logs are not natively sent to CloudWatch but you can use Route53 Resolver query logging (outside CDK).
   // - This log group is a placeholder for capturing related events from Lambdas or monitoring tools.
   // - ACM certificate must be in us-east-1 for CloudFront distributions.
}