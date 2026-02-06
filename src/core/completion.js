import { listServices } from './registry.js';

/**
 * 生成 Shell 补全脚本
 * @param {string} shell - Shell 类型 (bash/zsh/powershell/fish)
 * @returns {string}
 */
export function generateCompletionScript(shell) {
  const scripts = {
    bash: bashScript(),
    zsh: zshScript(),
    powershell: powershellScript(),
    fish: fishScript()
  };

  return scripts[shell] || scripts.bash;
}

/**
 * 补全查询函数（被补全脚本调用）
 * @param {string} current - 当前输入的词
 * @param {string} words - 所有输入的词（空格分隔）
 * @returns {Array<string>}
 */
export function getCompletions(current, words) {
  const wordList = words.split(' ').filter(Boolean);
  const cmd = wordList[wordList.length - 2] || '';

  // 补全主命令
  if (wordList.length <= 2) {
    return ['list', 'switch', 'current', 'diff', 'backup', 'restore', 'init', 'undo', 'completion', 'audit', '--help', '-h'];
  }

  // 补全 --service/-s 参数的值
  if (cmd === '--service' || cmd === '-s') {
    return listServices().map(s => s.id);
  }

  // 补全 switch 命令的变体名
  if (wordList[1] === 'switch' || wordList[1] === 'sw') {
    const serviceIndex = wordList.indexOf('--service') + 1 || wordList.indexOf('-s') + 1;
    const service = serviceIndex > 0 && serviceIndex < wordList.length ? wordList[serviceIndex] : 'claude';

    const adapter = getAdapter(service);
    if (adapter) {
      try {
        return adapter.scanVariants().map(v => v.name);
      } catch {
        return [];
      }
    }
  }

  // 补全 diff 命令的变体名
  if (wordList[1] === 'diff') {
    const serviceIndex = wordList.indexOf('--service') + 1 || wordList.indexOf('-s') + 1;
    const service = serviceIndex > 0 && serviceIndex < wordList.length ? wordList[serviceIndex] : 'claude';

    const adapter = getAdapter(service);
    if (adapter) {
      try {
        return adapter.scanVariants().map(v => v.name);
      } catch {
        return [];
      }
    }
  }

  return [];
}

function getAdapter(service) {
  try {
    const { getAdapter } = require('./registry.js');
    return getAdapter(service);
  } catch {
    return null;
  }
}

function bashScript() {
  return `#!/bin/bash
_cs_cli_completion() {
  local cur words
  cur="\${COMP_WORDS[COMP_CWORD]}"
  words=("\${COMP_WORDS[@]}")

  COMPREPLY=($(compgen -W "$(cs-cli completion --query "\$cur" "\${words[*]}")" -- "\$cur"))
}

complete -F _cs_cli_completion cs-cli
`;
}

function zshScript() {
  return `#compdef cs-cli
_cs_cli() {
  local -a completions
  completions=("\$(cs-cli completion --query "\${words[CURRENT-1]}" "\${words[*]}")")
  _describe 'values' completions
}
`;
}

function powershellScript() {
  return `Register-ArgumentCompleter -Native -CommandName cs-cli -ScriptBlock {
  param(\$wordToComplete, \$commandAst, \$cursorPosition)
  \$completions = & cs-cli completion --query \$wordToComplete \$commandAst.ToString()
  \$completions | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new(\$_, \$_, 'ParameterValue', \$_)
  }
}
`;
}

function fishScript() {
  return `complete -c cs-cli -f
complete -c cs-cli -n '__fish_use_subcommand' -a list switch current diff backup restore init undo completion audit
complete -c cs-cli -n '__fish_seen_subcommand_from switch' -a '(cs-cli completion --query (commandline -cp))'
`;
}
