import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const platform = process.argv[2];

function findJavaHome(): string | undefined {
    const installations = path.join(homedir(), ".local/share/mise/installs/java");
    const candidates = [
        process.env.JAVA_HOME,
        "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
        ...(existsSync(installations) ? readdirSync(installations).map((name) => path.join(installations, name)) : []),
    ];
    return candidates.find((candidate) => {
        if (!candidate) return false;
        const java = path.join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java");
        const result = spawnSync(java, ["-version"], { encoding: "utf8" });
        const major = Number(/version "(\d+)/.exec(result.stderr ?? "")?.[1]);
        return result.status === 0 && major >= 21 && major <= 24;
    });
}

if (platform === "ios") {
    const result = spawnSync(
        "xcodebuild",
        [
            "-project",
            path.join(root, "packages/ios/native/App/App.xcodeproj"),
            "-scheme",
            "App",
            "-destination",
            "generic/platform=iOS Simulator",
            "-derivedDataPath",
            path.join(root, "packages/ios/build"),
            "CODE_SIGNING_ALLOWED=NO",
            "build",
        ],
        { stdio: "inherit" },
    );
    if (result.error) console.error(result.error.message);
    process.exit(result.status ?? 1);
} else if (platform === "android") {
    const sdk =
        process.env.ANDROID_HOME ??
        process.env.ANDROID_SDK_ROOT ??
        path.join(homedir(), process.platform === "darwin" ? "Library/Android/sdk" : "Android/Sdk");
    if (!existsSync(sdk)) throw new Error("Install the Android SDK and set ANDROID_HOME to its location.");
    const javaHome = findJavaHome();
    const result = spawnSync(process.platform === "win32" ? "gradlew.bat" : "./gradlew", ["assembleDebug"], {
        cwd: path.join(root, "packages/android/native"),
        stdio: "inherit",
        env: { ...process.env, ANDROID_HOME: sdk, ...(javaHome ? { JAVA_HOME: javaHome } : {}) },
    });
    if (result.error) console.error(result.error.message);
    process.exit(result.status ?? 1);
} else {
    throw new Error("Choose ios or android for the native build.");
}
