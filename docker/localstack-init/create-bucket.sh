#!/bin/sh
set -e

awslocal s3 mb "s3://${S3_BUCKET_NAME}"
