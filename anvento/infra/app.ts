// AnventoHermes: one EC2 box running the Hermes Slack gateway. Runbook: README.md.
import { App, CfnOutput, SecretValue, Stack, Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import { readFileSync } from 'fs';
import { join } from 'path';

const app = new App();
// Account comes from the deploying profile, so the public repo never names it.
const stack = new Stack(app, 'AnventoHermes', { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' } });
Tags.of(stack).add('Project', 'anvento-hermes');

// Slack Socket Mode is outbound-only: a public subnet, no NAT, no inbound rules.
// The AZ is explicit so synth needs no context lookup (which would write the account into cdk.context.json).
const vpc = new ec2.Vpc(stack, 'Vpc', {
  availabilityZones: ['us-east-1a'],
  natGateways: 0,
  subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC }],
});
const sg = new ec2.SecurityGroup(stack, 'Sg', { vpc, allowAllOutbound: true, description: 'Hermes box: no inbound' });

// boot.sh writes these keys to $HERMES_HOME/.env on every boot. Placeholders are set once;
// values edited in the console survive later deploys because the template value never changes.
const secret = new sm.Secret(stack, 'Env', {
  secretName: 'anvento-hermes/env',
  description: 'Hermes box .env (written on every boot). Replace the placeholders, then reboot the box.',
  secretObjectValue: {
    SLACK_BOT_TOKEN: SecretValue.unsafePlainText('replace-me'),
    SLACK_APP_TOKEN: SecretValue.unsafePlainText('replace-me'),
  },
});

// cloud-init runs user scripts once per instance by default; this makes boot.sh run on every boot,
// which is how a reboot redeploys.
const userData = new ec2.MultipartUserData();
userData.addPart(ec2.MultipartBody.fromRawBody({
  contentType: 'text/cloud-config; charset="utf-8"',
  body: '#cloud-config\ncloud_final_modules:\n- [scripts-user, always]\n',
}));
userData.addPart(ec2.MultipartBody.fromUserData(ec2.UserData.custom(readFileSync(join(__dirname, 'boot.sh'), 'utf8'))));

const box = new ec2.Instance(stack, 'Box', {
  instanceName: 'anvento-hermes',
  vpc,
  securityGroup: sg,
  instanceType: new ec2.InstanceType('t4g.small'),
  // Ubuntu 24.04 arm64 (noble-20261004). Pinned: changing it replaces the box.
  machineImage: ec2.MachineImage.genericLinux({ 'us-east-1': 'ami-0e1ab5c876cc030e8' }),
  // The Docker sandbox sits one hop behind the host, so hop limit 1 keeps instance credentials out of it.
  httpTokens: ec2.HttpTokens.REQUIRED,
  httpPutResponseHopLimit: 1,
  blockDevices: [{
    deviceName: '/dev/sda1',
    // Sessions and memories live here; the volume outlives an accidental instance replacement.
    volume: ec2.BlockDeviceVolume.ebs(30, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true, deleteOnTermination: false }),
  }],
  userData,
});

secret.grantRead(box);
box.addToRolePolicy(new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
  resources: [
    'arn:aws:bedrock:*::foundation-model/anthropic.*',
    `arn:aws:bedrock:*:${stack.account}:inference-profile/us.anthropic.*`,
  ],
}));
box.addToRolePolicy(new iam.PolicyStatement({
  actions: ['bedrock:ListFoundationModels', 'bedrock:ListInferenceProfiles'],
  resources: ['*'],
}));

new CfnOutput(stack, 'InstanceId', { value: box.instanceId });
new CfnOutput(stack, 'SecretName', { value: secret.secretName });
