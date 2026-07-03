Canvas 当前支持的简短 ANSI 语法规则。

真实 ANSI 写法是 `ESC[...m`，也就是 `\x1b[...m`。为了方便，省略前面的 ESC 字符，只写成：

```
[38;2;255;0;0m红色文字[0m
[48;2;219;234;254m蓝底文字[0m
```

支持的规则：

```
[0m                  reset，清空样式
[1m                  bold
[22m                 关闭 bold
[3m                  italic
[23m                 关闭 italic
[4m                  underline
[24m                 关闭 underline
[7m                  inverse
[27m                 关闭 inverse
[9m                  strike
[29m                 关闭 strike

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

