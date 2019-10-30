const DEFAULT_FIELDS = [
  'keywords',
  'author',
  'repository',
  'license',
  'engines',
  'publishConfig'
];

exports.DEFAULT_FIELDS = DEFAULT_FIELDS;
exports.syncFile = require('./sync-file').syncFile;
exports.syncPackageJsons = require('./sync-package').syncPackageJsons;
exports.SyncMonorepoPackagesError = require('./error').SyncMonorepoPackagesError;
exports.summarizeFileCopies = require('./sync-file').summarizeFileCopies;
exports.summarizePackageChanges = require('./sync-package').summarizePackageChanges;
