// lib/frontend-servicecatalog.ts
import * as cdk from 'aws-cdk-lib';
import * as servicecatalog from 'aws-cdk-lib/aws-servicecatalog';
import { Construct } from 'constructs';
import { addFrontendDevProductToPortfolio } from './products/frontend-dev-product';

/**
 * ==============================
 * Service Catalog Portfolio for Frontend Team
 * ==============================
 *
 * This stack wires IAM roles with a Service Catalog Portfolio.
 * It enables frontend devs to self-service launch pre-approved infrastructure stacks.
 */
export class FrontendServiceCatalogStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    launchRoleArn: string;
    endUserRoleArn: string;
  }) {
    super(scope, id, props);

    // Create a Service Catalog Portfolio
    const portfolio = new servicecatalog.Portfolio(this, 'FrontendPortfolio', {
      displayName: 'Frontend Dev Infrastructure Portfolio',
      providerName: 'Platform Admin',
      description: 'Contains curated frontend infra stacks (S3, CloudFront, EC2, etc.)'
    });

    // Import IAM roles by ARN
    const launchRole = servicecatalog.Role.fromRoleArn(this, 'LaunchRoleImport', props.launchRoleArn);
    const endUserRole = servicecatalog.Role.fromRoleArn(this, 'EndUserRoleImport', props.endUserRoleArn);

    // Associate roles with portfolio
    portfolio.setLaunchRole(launchRole);
    portfolio.giveAccessToRole(endUserRole);

    // Add Frontend Dev Product to the portfolio
    addFrontendDevProductToPortfolio(this, portfolio);
  }
}
