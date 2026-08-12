# Canvas 文本语法

真实 ANSI 写法是 `ESC[...m`，即 `\x1b[...m`。CharDesk 省略 ESC 字符：

```
[38;2;255;0;0m红色文字[0m
[48;2;219;234;254m蓝底文字[0m
```

```
[0m                  reset
[1m / [22m            bold 开 / 关
[3m / [23m            italic 开 / 关
[4m / [24m            underline 开 / 关
[7m / [27m            inverse 开 / 关
[9m / [29m            strike 开 / 关

[30m - [37m          8 色前景色
[90m - [97m          bright 前景色
[39m                 重置前景色
[40m - [47m          8 色背景色
[100m - [107m        bright 背景色
[49m                 重置背景色

[38;5;Nm             256 色前景色
[48;5;Nm             256 色背景色
[38;2;R;G;Bm         truecolor 前景色
[48;2;R;G;Bm         truecolor 背景色
```

解析与布局规则见 [`CharDesk Text Protocol v1`](../../../../packages/protocol/spec/v1.md)。
