#!/bin/bash
# check-std-existence.sh

echo "🔍 检查 std 和 core 库"
echo "======================"

TARGET="aarch64-linux-android"
TOOLCHAIN=$(rustup show active-toolchain | cut -d' ' -f1)
echo "工具链: $TOOLCHAIN"
echo "目标: $TARGET"

# 检查标准库路径
STD_PATH="$HOME/.rustup/toolchains/$TOOLCHAIN/lib/rustlib/$TARGET/lib"
echo "标准库路径: $STD_PATH"

if [ -d "$STD_PATH" ]; then
    echo "目录存在，内容:"
    ls -la "$STD_PATH" 2>/dev/null | head -20
    
    # 检查关键库文件
    echo -e "\n检查关键库文件:"
    for lib in libstd libcore liballoc; do
        if ls "$STD_PATH/$lib"*.rlib 1> /dev/null 2>&1; then
            echo "✅ $lib 存在"
        else
            echo "❌ $lib 不存在"
        fi
    done
else
    echo "❌ 目录不存在！"
fi

# 检查 rustc 能否找到标准库
echo -e "\n检查 rustc 标准库搜索路径:"
rustc --print target-libdir --target $TARGET 2>/dev/null || echo "无法获取目标库目录"

# 检查 sysroot
echo -e "\nSysroot 信息:"
rustc --print sysroot
