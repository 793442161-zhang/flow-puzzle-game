/** 
 * 设计系统：清新、可爱、圆润风格
 */

// 主色调：薄荷绿 + 珊瑚粉 + 天蓝色
export const COLORS = {
  // 背景
  BG_MAIN: 0xF0FDF4,        // 极浅薄荷绿背景
  BG_CARD: 0xFFFFFF,        // 白色卡片背景

  // 网格格子
  CELL_BG: 0xE8F5E9,        // 未填充格子：浅绿色
  CELL_BORDER: 0xC8E6C9,    // 格子边框：浅绿色描边
  CELL_SHADOW: 0xA5D6A7,    // 格子阴影

  // 路径颜色（渐变色组）
  PATH_MAIN: 0x4FC3F7,      // 天蓝色路径
  PATH_GLOW: 0xB3E5FC,      // 路径光晕
  PATH_START: 0xFF7043,     // 起点：珊瑚粉
  PATH_END: 0xFFD54F,       // 终点：暖黄色

  // 圆点
  DOT_OUTER: 0xFFFFFF,      // 圆点外圈白色
  DOT_INNER_START: 0xFF7043,
  DOT_INNER_END: 0xFFD54F,

  // UI
  BTN_PRIMARY: 0x66BB6A,    // 主按钮：薄荷绿
  BTN_PRIMARY_TEXT: 0xFFFFFF,
  BTN_SECONDARY: 0xFFFFFF,
  BTN_SECONDARY_TEXT: 0x66BB6A,
  BTN_HINT: 0xFFD54F,       // 提示按钮：暖黄
  BTN_RESET: 0xFF8A65,      // 重置：橙粉

  // 文字
  TEXT_TITLE: 0x2E7D32,     // 标题：深绿
  TEXT_BODY: 0x4CAF50,      // 正文：中绿
  TEXT_LIGHT: 0xA5D6A7,     // 浅文字
  TEXT_WHITE: 0xFFFFFF,

  // 特效
  PARTICLE_1: 0xFF7043,
  PARTICLE_2: 0xFFD54F,
  PARTICLE_3: 0x4FC3F7,
  PARTICLE_4: 0xAB47BC,
  PARTICLE_5: 0x66BB6A,

  // 星星
  STAR: 0xFFD700,
  STAR_EMPTY: 0xDCE775,

  // 遮罩
  OVERLAY: 0x000000,
};

// 字体
export const FONTS = {
  TITLE: { fontFamily: '"Nunito", "PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '48px', fontStyle: 'bold', color: '#2E7D32' },
  SUBTITLE: { fontFamily: '"Nunito", "PingFang SC", sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#4CAF50' },
  BODY: { fontFamily: '"Nunito", "PingFang SC", sans-serif', fontSize: '22px', color: '#66BB6A' },
  BTN: { fontFamily: '"Nunito", "PingFang SC", sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF' },
  LEVEL: { fontFamily: '"Nunito", "PingFang SC", sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#FFFFFF' },
};

// 网格尺寸（根据屏幕自适应）
export const GRID = {
  MAX_GRID_WIDTH: 320,   // 网格区域最大宽度
  MAX_GRID_HEIGHT: 380,  // 网格区域最大高度
  CELL_GAP: 6,           // 格子间距
  CELL_RADIUS: 12,       // 格子圆角半径
  PATH_RADIUS: 0.38,     // 路径宽度相对格子尺寸的比例
};

// 动画时长
export const ANIM = {
  CELL_FILL: 120,         // 格子填充动画
  WIN_DELAY: 400,         // 过关弹窗延迟
  PARTICLE_DURATION: 800, // 粒子动画
  HINT_STEP_DELAY: 150,   // 提示逐步显示延迟
};
