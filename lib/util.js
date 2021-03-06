'use strict';
// ==================================================================================
// utils.js
// ----------------------------------------------------------------------------------
// Description:   System Information - library
//                for Node.js
// Copyright:     (c) 2014 - 2018
// Author:        Sebastian Hildebrandt
// ----------------------------------------------------------------------------------
// License:       MIT
// ==================================================================================
// 0. helper functions
// ----------------------------------------------------------------------------------

const os = require('os');
const fs = require('fs');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;

let _platform = process.platform;
const _linux = (_platform === 'linux');
const _darwin = (_platform === 'darwin');
const _windows = (_platform === 'win32');
const _freebsd = (_platform === 'freebsd');
const _openbsd = (_platform === 'openbsd');
// const _sunos = (_platform === 'sunos');

let _cores = 0;
let wmic = '';
let codepage = '';

const execOptsWin = {
  windowsHide: true,
  maxBuffer: 1024 * 2000,
  encoding: 'UTF-8'
};

function isFunction(functionToCheck) {
  let getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

function unique(obj) {
  let uniques = [];
  let stringify = {};
  for (let i = 0; i < obj.length; i++) {
    let keys = Object.keys(obj[i]);
    keys.sort(function (a, b) { return a - b; });
    let str = '';
    for (let j = 0; j < keys.length; j++) {
      str += JSON.stringify(keys[j]);
      str += JSON.stringify(obj[i][keys[j]]);
    }
    if (!stringify.hasOwnProperty(str)) {
      uniques.push(obj[i]);
      stringify[str] = true;
    }
  }
  return uniques;
}

function sortByKey(array, keys) {
  return array.sort(function (a, b) {
    let x = '';
    let y = '';
    keys.forEach(function (key) {
      x = x + a[key]; y = y + b[key];
    });
    return ((x < y) ? -1 : ((x > y) ? 1 : 0));
  });
}

function cores() {
  if (_cores === 0) {
    _cores = os.cpus().length;
  }
  return _cores;
}

function getValue(lines, property, separator, trimmed) {
  separator = separator || ':';
  property = property.toLowerCase();
  trimmed = trimmed || false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].toLowerCase().replace(/\t/g, '');
    if (trimmed) {
      line = line.trim();
    }
    if (line.startsWith(property)) {
      const parts = lines[i].split(separator);
      if (parts.length >= 2) {
        parts.shift();
        return parts.join(separator).trim();
      } else {
        return '';
      }
    }
  }
  return '';
}

function decodeEscapeSequence(str, base) {
  base = base || 16;
  return str.replace(/\\x([0-9A-Fa-f]{2})/g, function () {
    return String.fromCharCode(parseInt(arguments[1], base));
  });
}

function parseDateTime(dt) {
  const result = {
    date: '',
    time: ''
  };
  const parts = dt.split(' ');
  if (parts[0]) {
    if (parts[0].indexOf('/') >= 0) {
      // Dateformat: mm/dd/yyyy
      const dtparts = parts[0].split('/');
      if (dtparts.length === 3) {
        result.date = dtparts[2] + '-' + ('0' + dtparts[0]).substr(-2) + '-' + ('0' + dtparts[1]).substr(-2);
      }
    }
    if (parts[0].indexOf('.') >= 0) {
      // Dateformat: dd.mm.yyyy
      const dtparts = parts[0].split('.');
      if (dtparts.length === 3) {
        result.date = dtparts[2] + '-' + ('0' + dtparts[1]).substr(-2) + '-' + ('0' + dtparts[0]).substr(-2);
      }
    }
    if (parts[0].indexOf('-') >= 0) {
      // Dateformat: yyyy-mm-dd
      const dtparts = parts[0].split('-');
      if (dtparts.length === 3) {
        result.date = dtparts[0] + '-' + ('0' + dtparts[1]).substr(-2) + '-' + ('0' + dtparts[2]).substr(-2);
      }
    }
  }
  if (parts[1]) {
    result.time = parts[1];
  }
  return result;
}

function findObjectByKey(array, key, value) {
  for (let i = 0; i < array.length; i++) {
    if (array[i][key] === value) {
      return i;
    }
  }
  return -1;
}

function getWmic() {
  if (os.type() === 'Windows_NT' && !wmic) {
    if (fs.existsSync(process.env.WINDIR + '\\system32\\wbem\\wmic.exe')) {
      wmic = process.env.WINDIR + '\\system32\\wbem\\wmic.exe';
    } else wmic = 'wmic';
  }
  return wmic;
}

function powerShell(cmd) {
  return new Promise((resolve, reject) => {
    process.nextTick(() => {

      let result = '';
      const child = spawn('powershell.exe', ['-NoLogo', '-InputFormat', 'Text', '-NoExit', '-ExecutionPolicy', 'Unrestricted', '-Command', '-'], {
        stdio: 'pipe'
      });

      child.stdout.on('data', function (data) {
        result = result + data.toString('utf8');
      });
      child.stderr.on('data', function (data) {
        child.kill();
        reject(data);
      });
      child.on('close', function () {
        child.kill();
        resolve(result);
      });

      child.stdin.write(cmd + '\n');
      child.stdin.end();
    });
  });
}

function getCodepage() {
  if (_windows) {
    if (!codepage) {
      try {
        const stdout = execSync('chcp');
        const lines = stdout.toString().split('\r\n');
        const parts = lines[0].split(':');
        codepage = parts.length > 1 ? parts[1].replace('.', '') : '';
      } catch (err) {
        codepage = '437';
      }
    }
    return codepage;
  }
  if (_linux || _darwin || _freebsd || _openbsd) {
    if (!codepage) {
      try {
        const stdout = execSync('echo $LANG');
        const lines = stdout.toString().split('\r\n');
        const parts = lines[0].split('.');
        codepage = parts.length > 1 ? parts[1].trim : '';
      } catch (err) {
        codepage = 'UTF-8';
      }
    }
    return codepage;
  }
}

function execWin(cmd, opts, callback) {
  if (!callback) {
    callback = opts;
    opts = execOptsWin;
  }
  let newCmd = 'chcp 65001 > nul && cmd /C ' + cmd + ' && chcp ' + codepage + ' > nul';
  exec(newCmd, opts, function (error, stdout) {
    callback(error, stdout);
  });
}

function nanoSeconds() {
  const time = process.hrtime();
  if (!Array.isArray(time) || time.length !== 2) {
    return 0;
  }
  return +time[0] * 1e9 + +time[1];
}

function noop() { }

exports.execOptsWin = execOptsWin;
exports.getCodepage = getCodepage;
exports.execWin = execWin;
exports.isFunction = isFunction;
exports.unique = unique;
exports.sortByKey = sortByKey;
exports.cores = cores;
exports.getValue = getValue;
exports.decodeEscapeSequence = decodeEscapeSequence;
exports.parseDateTime = parseDateTime;
exports.findObjectByKey = findObjectByKey;
exports.getWmic = getWmic;
exports.powerShell = powerShell;
exports.nanoSeconds = nanoSeconds;
exports.noop = noop;
