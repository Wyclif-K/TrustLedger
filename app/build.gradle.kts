import java.util.Properties
import org.gradle.api.Project

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

/** Machine-specific IP: set `TRUSTLEDGER_API_BASE_URL` in root `local.properties` (gitignored). Fallback: `gradle.properties`, then empty → use `strings.xml`. */
fun Project.readTrustLedgerApiBaseUrl(): String {
    val props = Properties()
    rootProject.file("local.properties").takeIf { it.exists() }?.reader()?.use { props.load(it) }
    props.getProperty("TRUSTLEDGER_API_BASE_URL")?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    return (findProperty("TRUSTLEDGER_API_BASE_URL") as String?)?.trim().orEmpty()
}

android {
    namespace = "com.example.trustledger"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.trustledger"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        val apiBase = project.readTrustLedgerApiBaseUrl()
        val escaped = apiBase.replace("\\", "\\\\").replace("\"", "\\\"")
        buildConfigField("String", "API_BASE_URL", "\"$escaped\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    jvmToolchain(21)
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.activity:activity:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}