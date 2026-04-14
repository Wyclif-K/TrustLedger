package com.example.trustledger

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import java.util.Locale

/**
 * Swaps the launcher entry between two activity aliases so staff (admin dashboard roles) see the
 * gold landmark icon; members keep the default TrustLedger icon.
 */
object LauncherIconHelper {

    private const val ALIAS_MEMBER = "com.example.trustledger.LauncherMember"
    private const val ALIAS_ADMIN = "com.example.trustledger.LauncherAdmin"

    private fun isStaffRole(role: String?): Boolean {
        if (role.isNullOrBlank()) return false
        return when (role.uppercase(Locale.US)) {
            "ADMIN", "SUPER_ADMIN", "AUDITOR" -> true
            else -> false
        }
    }

    fun syncForRole(context: Context, role: String?) {
        val pm = context.packageManager
        val pkg = context.packageName
        val member = ComponentName(pkg, ALIAS_MEMBER)
        val admin = ComponentName(pkg, ALIAS_ADMIN)
        val staff = isStaffRole(role)

        if (staff) {
            pm.setComponentEnabledSetting(
                admin,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP,
            )
            pm.setComponentEnabledSetting(
                member,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP,
            )
        } else {
            pm.setComponentEnabledSetting(
                member,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP,
            )
            pm.setComponentEnabledSetting(
                admin,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP,
            )
        }
    }
}
