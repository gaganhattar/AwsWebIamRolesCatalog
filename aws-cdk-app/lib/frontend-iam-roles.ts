// lib/frontend-iam-roles.ts
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * ============================
 * IAM Role Definitions for Frontend Service Catalog Access
 * ============================
 *
 * This stack defines IAM roles scoped for the frontend team to interact with Service Catalog
 * and access S3 buckets from EC2 and CI/CD pipelines.
 *
 * 🔐 Roles:
 * 1. Launch Role – assumed by AWS Service Catalog to provision infrastructure
 * 2. End User Role – assumed by frontend developers to browse and launch approved SC products
 * 3. Frontend S3 Access Role – for pipelines or tools to upload static assets to S3
 * 4. EC2 Instance Role – allows compute instances to access S3 buckets securely
 */
export class FrontendIamRolesStack extends cdk.Stack {
  public readonly launchRole: iam.Role;
  public readonly devEndUserRole: iam.Role;
  public readonly s3AccessRole: iam.Role;
  public readonly ec2InstanceRole: iam.Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========== SERVICE CATALOG LAUNCH ROLE ==========
    this.launchRole = new iam.Role(this, 'FrontendSCCatalogLaunchRole', {
      assumedBy: new iam.ServicePrincipal('servicecatalog.amazonaws.com'),
      roleName: 'FrontendSCCatalogLaunchRole',
      description: 'Used by Service Catalog to provision frontend infrastructure',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess') // 🔒 adjust later
      ]
    });

    // ========== DEV TEAM END USER ROLE ==========
    this.devEndUserRole = new iam.Role(this, 'FrontendDevSCUserRole', {
      assumedBy: new iam.AccountRootPrincipal(),
      roleName: 'FrontendDevSCUserRole',
      description: 'Allows frontend developers to browse and launch Service Catalog products',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSServiceCatalogEndUserFullAccess')
      ]
    });

    // ========== S3 ACCESS ROLE FOR CI/CD OR DEV TOOLS ==========
    this.s3AccessRole = new iam.Role(this, 'FrontendS3AccessRole', {
      assumedBy: new iam.AccountRootPrincipal(), // Update for federated/OIDC CI/CD if needed
      roleName: 'FrontendS3AccessRole',
      description: 'Allows CI/CD or devs to upload static frontend assets to S3',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')
      ]
    });

    // ========== EC2 INSTANCE ROLE FOR S3 ACCESS ==========
    this.ec2InstanceRole = new iam.Role(this, 'FrontendEc2S3AccessRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      roleName: 'FrontendEc2S3AccessRole',
      description: 'Allows EC2 instances to access S3 content',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
      ]
    });

    // Optionally attach instance profile if used in ASG/LaunchTemplate
    new iam.CfnInstanceProfile(this, 'FrontendEc2InstanceProfile', {
      roles: [this.ec2InstanceRole.roleName],
      instanceProfileName: 'FrontendEc2InstanceProfile'
    });
  }
}
