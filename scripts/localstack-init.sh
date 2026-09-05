#!/bin/bash
set -e

echo "Initializing LocalStack S3..."

awslocal s3 mb s3://baia-assets 2>/dev/null || true

awslocal s3api put-bucket-policy --bucket baia-assets --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::baia-assets/*"
    }
  ]
}'

echo "LocalStack S3 initialized: bucket 'baia-assets' created with public-read policy"
