// lib/frontend-security-stack.ts

/**
 * File: frontend-security-stack.ts
 * Date: 2025-03-27
 * Author: Gaganjit Singh Hattar
 * Description: Defines a WAF WebACL for frontend infrastructure
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
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface FrontendSecurityStackProps extends cdk.StackProps {
  cloudfrontDistribution: cloudfront.IDistribution;
}

export class FrontendSecurityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendSecurityStackProps) {
    super(scope, id, props);

    // Create a CloudWatch log group for WAF logs
    const wafLogGroup = new logs.LogGroup(this, 'WafLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create a basic WAF WebACL with AWS managed rule group and logging
    const webAcl = new wafv2.CfnWebACL(this, 'FrontendWebACL', {
      defaultAction: { allow: {} },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'FrontendWebACL',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWS-AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSCommonRules',
          },
        },
      ],
    });

    // Enable logging for the WebACL to the created log group
    new wafv2.CfnLoggingConfiguration(this, 'WafLogging', {
      resourceArn: webAcl.attrArn,
      logDestinationConfigs: [wafLogGroup.logGroupArn],
    });

    // Associate WAF WebACL with the CloudFront distribution
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      resourceArn: props.cloudfrontDistribution.distributionArn,
      webAclArn: webAcl.attrArn,
    });
  }
}
