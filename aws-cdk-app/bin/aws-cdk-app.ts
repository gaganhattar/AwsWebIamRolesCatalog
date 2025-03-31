#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FrontendServiceCatalogStack } from '../lib/frontend-servicecatalog';
import { VpcNetworkStack } from '../lib/vpc-network-stack';
import { FrontendScpPoliciesStack } from '../lib/frontend-scp-policies';
import { FrontendIamRolesStack } from '../lib/frontend-iam-roles';
import { FrontendServiceQuotasStack } from '../lib/frontend-service-qouta';
import { FrontendBudgetsStack } from '../lib/frontend-service-qouta';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION
};

/** Foundational Steps provisioning VPC, Devteam OU, Devteam Account, SCP, IAM roles */
// **Caution**: This stack assumes no foundation infrastructure is deployed and no VPC/networking is already present in the account.
// We are creating VPC with CIDR = 10.0.0.0/16. If you have an existing VPC, please update the CIDR accordingly.    

// 1. Create the VPC and networking resources
const vpcStack = new VpcNetworkStack(app, 'VpcNetworkStack', { env });

// 2. Creates OU and SCP to restrict access to the VPC 
new FrontendScpPoliciesStack(app, 'FrontendScpPoliciesStack');

// 3. IAM roles for frontend team to interact with Service Catalog and S3
const iamStack = new FrontendIamRolesStack(app, 'FrontendIamRolesStack', { env });

// 4. Enforce Service Quotas to prevent overuse of EC2, S3, etc.
new FrontendServiceQuotasStack(app, 'FrontendServiceQuotasStack', { env });

// 5. Set up budget monitoring with user-defined email
const budgetEmail = app.node.tryGetContext('budgetEmail');
if (!budgetEmail) {
  throw new Error('Missing --context budgetEmail=yourname@example.com');
}

new FrontendBudgetsStack(app, 'FrontendBudgetsStack', {
  env,
  budgetEmail: budgetEmail

});

// 6. Pass role ARNs to Service Catalog stack
new FrontendServiceCatalogStack(app, 'FrontendServiceCatalogStack', {
  env,
  launchRoleArn: iamStack.launchRole.roleArn,
  endUserRoleArn: iamStack.devEndUserRole.roleArn
});
