// lib/frontend-compute-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { CloudFrontIpProvider } from './cloudfront-ip-provider';
import { Construct } from 'constructs';

export class FrontendComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create security group for ALB
    const albSG = new ec2.SecurityGroup(this, 'AlbSG', {
      vpc,
      description: 'Allow HTTP/HTTPS to ALB',
      allowAllOutbound: true,
    });

    // Fetch CloudFront IPs dynamically using custom resource
    const cloudfrontIpProvider = new CloudFrontIpProvider(this, 'CloudFrontIpProvider');

    // Add each IP as an ingress rule for ALB
    for (const cidr of cloudfrontIpProvider.cloudfrontIpList) {
      albSG.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(80), `Allow HTTP from ${cidr}`);
      albSG.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(443), `Allow HTTPS from ${cidr}`);
    }

    // Public-facing ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'FrontendALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSG,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const listener = alb.addListener('Listener', {
      port: 80,
      open: true,
    });

    // Security group for EC2
    const ec2SG = new ec2.SecurityGroup(this, 'Ec2SG', {
      vpc,
      description: 'Allow traffic from ALB to EC2',
      allowAllOutbound: true,
    });
    ec2SG.addIngressRule(albSG, ec2.Port.tcp(80));

    // CDK parameters
    const minCapacity = new cdk.CfnParameter(this, 'MinCapacity', {
      type: 'Number',
      default: 1,
      description: 'Minimum EC2 instances in ASG',
    });

    const maxCapacity = new cdk.CfnParameter(this, 'MaxCapacity', {
      type: 'Number',
      default: 3,
      description: 'Maximum EC2 instances in ASG',
    });

    // Auto Scaling Group
    const asg = new autoscaling.AutoScalingGroup(this, 'FrontendASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      minCapacity: minCapacity.valueAsNumber,
      maxCapacity: maxCapacity.valueAsNumber,
      desiredCapacity: 1,
      securityGroup: ec2SG,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Attach targets to ALB
    listener.addTargets('AppTargets', {
      port: 80,
      targets: [asg],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
      },
    });
  }
}