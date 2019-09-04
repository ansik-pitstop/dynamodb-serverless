#!/bin/bash

set -e

conf_path=$1

run() {
    echo "collect configuration from: ${conf_path}"
    cp ${conf_path} ./conf.json
    echo "deploy with serverless"
    serverless deploy
}

if [[ "$#" -ne 1 ]]; then
    echo "usage: $0 CONF_PATH"
    exit 1
fi

run
