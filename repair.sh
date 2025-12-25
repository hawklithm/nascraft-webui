#!/bin/bash
# full-android-fix.sh

set -e

echo "🔄 完整修复 Android 构建问题"
echo "============================="

# 1. 清理
echo "1. 清理..."
cd ./src-tauri
cargo clean
rm -rf target
rm -rf .cargo
cd -

# 2. 重新安装 Rust 目标
echo "2. 重新安装 Rust Android 目标..."
rustup target remove aarch64-linux-android
sleep 1
rustup target add aarch64-linux-android

# 3. 创建配置
echo "3. 创建 Cargo 配置..."
mkdir -p .cargo

NDK_HOME=$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk | sort -V | tail -1)

# 尝试不同的 API 级别
for api_level in 21 24 29 30; do
    LINKER="$NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android${api_level}-clang"
    if [[ -f "$LINKER" ]]; then
        echo "找到链接器: $LINKER"
        cat > .cargo/config.toml << EOF
[target.aarch64-linux-android]
linker = "$LINKER"
ar = "$NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-ar"
rustflags = [
    "-C", "link-arg=-Wl,-rpath,$NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/sysroot/usr/lib/aarch64-linux-android/$api_level",
    "-C", "link-arg=-L$NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/sysroot/usr/lib/aarch64-linux-android/$api_level",
]

[env]
ANDROID_NDK_ROOT = "$NDK_HOME"
EOF
        break
    fi
done

# 4. 设置环境变量
echo "4. 设置环境变量..."
export NDK_HOME
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=$(grep "linker =" .cargo/config.toml | cut -d'"' -f2)

# 5. 测试
echo "5. 测试编译..."
cat > /tmp/simple.rs << 'EOF'
fn main() {
    let x = 1;
    println!("{}", x);
}
EOF

echo "运行: cargo check --target aarch64-linux-android --manifest-path /tmp/simple.rs"
if cargo check --target aarch64-linux-android --manifest-path /tmp/simple.rs; then
    echo "✅ 测试通过！"
else
    echo "❌ 测试失败"
    cargo check --target aarch64-linux-android --manifest-path /tmp/simple.rs 2>&1 | tail -20
fi

rm -f /tmp/simple.rs

echo "✅ 修复完成！"
