#!/bin/bash
while IFS=" " read -r hash author email timestamp message; do
  GIT_COMMITTER_DATE="$timestamp" GIT_AUTHOR_DATE="$timestamp" GIT_COMMITTER_NAME="$author" GIT_AUTHOR_NAME="$author" GIT_COMMITTER_EMAIL="$email" GIT_AUTHOR_EMAIL="$email" git commit --allow-empty -m "$message"
  echo "Recreated commit: $message"
done < commit-history.txt
