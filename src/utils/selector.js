import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { styleText } from 'node:util';
import { t } from './i18n.js';

/**
 * 简单的终端交互式选择器 (使用 @inquirer/prompts 实现)
 * @param {Array<{name: string, label?: string, active?: boolean}>} options
 * @param {string} title - 标题
 * @param {object} config - 配置选项
 * @returns {Promise<string>} 选中的选项名称
 */
export async function selectOption(options, title = null, config = {}) {
  const {
    defaultTitle = t('ui.selectOption'),
    activeSuffix = t('ui.activeSuffix')
  } = config;

  const displayTitle = title || defaultTitle;

  if (options.length === 0) {
    throw new Error(t('ui.noOptions'));
  }

  // 找到默认选中的项
  const defaultOption = options.find(o => o.active);

  // 创建国际化主题
  const theme = {
    style: {
      keysHelpTip: (keys) => {
        // keys 格式: [['↑↓', 'navigate'], ['⏎', 'select']]
        // 将 action 翻译成当前语言
        const localizedKeys = keys.map(([key, action]) => {
          const actionKey = action === 'navigate' ? 'navigate' :
                           action === 'select' ? 'select' :
                           action === 'cancel' ? 'cancel' : action;
          return [key, t(`ui.keysHelp.${actionKey}`)];
        });
        // 使用与默认格式相同的方式
        return localizedKeys
          .map(([key, action]) => `${styleText('bold', key)} ${styleText('dim', action)}`)
          .join(styleText('dim', ' • '));
      }
    }
  };

  try {
    const answer = await select({
      message: displayTitle,
      choices: options.map(o => {
        let name = o.label || o.name;
        if (o.active) {
            name += chalk.green(activeSuffix);
        }
        return {
            name: name,
            value: o.name,
        };
      }),
      default: defaultOption ? defaultOption.name : undefined,
      theme,
    });
    return answer;
  } catch (error) {
    // @inquirer/prompts 在用户取消时 (Ctrl+C) 会抛出错误
    // 为了保持兼容性，我们将错误消息标准化为 'cancelled'
    if (error.name === 'ExitPromptError' || error.message.includes('force closed')) {
      throw new Error('cancelled');
    }
    throw error;
  }
}
