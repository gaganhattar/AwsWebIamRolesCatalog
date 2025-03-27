// lib/cloudfront-ip-provider.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export class CloudFrontIpProvider extends Construct {
  public readonly cloudfrontIpList: string[];

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Lambda function to fetch and filter CloudFront IP ranges
    const ipFetcherFunction = new lambda.Function(this, 'CloudFrontIpFetcherLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const https = require('https');

        exports.handler = async function(event) {
          const url = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
          const data = await new Promise((resolve, reject) => {
            https.get(url, (res) => {
              let body = '';
              res.on('data', (chunk) => body += chunk);
              res.on('end', () => resolve(body));
            }).on('error', reject);
          });

          const ranges = JSON.parse(data);
          const cloudfrontRanges = ranges.prefixes
            .filter(entry => entry.service === 'CLOUDFRONT' && entry.region === 'GLOBAL')
            .map(entry => entry.ip_prefix);

          return {
            statusCode: 200,
            status: 'SUCCESS',
            data: { CloudFrontIPs: cloudfrontRanges }
          };
        };`),
      timeout: cdk.Duration.seconds(30),
    });

    const provider = new cr.Provider(this, 'CloudFrontIpProviderCustomResource', {
      onEventHandler: ipFetcherFunction,
    });

    const customResource = new cdk.CustomResource(this, 'CloudFrontIpResource', {
      serviceToken: provider.serviceToken,
    });

    // Read IP list output
    const ipListStr = customResource.getAttString('CloudFrontIPs');
    this.cloudfrontIpList = ipListStr ? JSON.parse(ipListStr) : [];
  }
}
