export interface paths {
    "/api/v1/vaults": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_list_vaults"];
        put?: never;
        post: operations["web_create_vault"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vaults/{vaultId}/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_list_tags"];
        put?: never;
        post: operations["web_create_tag"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memories/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description Own account content; shared application rules. Browser session authentication. */
        post: operations["web_search_memories"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Own account content; shared application rules. Browser session authentication. */
        get: operations["web_get_memory"];
        put?: never;
        post?: never;
        /** @description Own account content; shared application rules. Browser session authentication. */
        delete: operations["web_delete_memory"];
        options?: never;
        head?: never;
        /** @description Own account content; shared application rules. Browser session authentication. */
        patch: operations["web_update_memory"];
        trace?: never;
    };
    "/api/v1/memories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description Own account content; shared application rules. Browser session authentication. */
        post: operations["web_create_memory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_get_csrf"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/setup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_setup_status"];
        put?: never;
        post: operations["web_setup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login/second-factor": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_login_factor"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_get_profile"];
        put?: never;
        post?: never;
        delete: operations["web_delete_account"];
        options?: never;
        head?: never;
        patch: operations["web_update_profile"];
        trace?: never;
    };
    "/api/v1/me/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_list_sessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["web_revoke_session"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/sessions/revoke-others": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_revoke_other_sessions"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_change_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/email-change": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_request_email_change"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/email-change/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_confirm_email"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/invitations/redeem": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_redeem_invitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/password-reset/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_request_password_reset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/password-reset/redeem": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_redeem_password_reset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/account-recovery/redeem": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_redeem_recovery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/totp/setup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_setup_totp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/totp/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_confirm_totp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/totp/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_disable_totp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/totp/recovery-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_replace_recovery_codes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vaults/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_get_vault"];
        put?: never;
        post?: never;
        delete: operations["web_delete_vault"];
        options?: never;
        head?: never;
        patch: operations["web_update_vault"];
        trace?: never;
    };
    "/api/v1/vaults/{vaultId}/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["web_delete_tag"];
        options?: never;
        head?: never;
        patch: operations["web_rename_tag"];
        trace?: never;
    };
    "/api/v1/vaults/{vaultId}/tags/{id}/merge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_merge_tags"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memories/{id}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_move_memory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memories/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_list_versions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memories/{id}/versions/{revision}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_get_version"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memories/{id}/versions/{revision}/restore-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_preview_restore"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/memories/{id}/restore-version": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_restore_version"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/trash/vaults": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_list_trashed_vaults"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vaults/{id}/trash": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_list_trashed_memories"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/trash/vaults/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_restore_vaults"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/trash/vaults/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["web_purge_vaults"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/trash/memories/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_restore_memories"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/trash/memories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["web_purge_memories"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-accesses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_list_agent_accesses"];
        put?: never;
        post: operations["web_create_agent_access"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-accesses/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_get_agent_access"];
        put?: never;
        post?: never;
        delete: operations["web_delete_agent_access"];
        options?: never;
        head?: never;
        patch: operations["web_update_agent_access"];
        trace?: never;
    };
    "/api/v1/agent-accesses/{id}/tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_list_tokens"];
        put?: never;
        post: operations["web_issue_token"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/agent-accesses/{id}/tokens/{tokenId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["web_revoke_token"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vaults/{id}/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_export_vault"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_prepare_import"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_get_import"];
        put?: never;
        post?: never;
        delete: operations["web_cancel_import"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/imports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_commit_import"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Active admin required; no other-account content access. */
        get: operations["admin_list_accounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/accounts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** @description Active admin required; no other-account content access. */
        delete: operations["admin_delete_account"];
        options?: never;
        head?: never;
        /** @description Active admin required; no other-account content access. */
        patch: operations["admin_update_account"];
        trace?: never;
    };
    "/api/v1/admin/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Active admin required; no other-account content access. */
        get: operations["admin_list_invitations"];
        put?: never;
        /** @description Active admin required; no other-account content access. */
        post: operations["admin_invite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/invitations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** @description Active admin required; no other-account content access. */
        delete: operations["admin_revoke_invitation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/accounts/{id}/password-reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description Active admin required; no other-account content access. */
        post: operations["admin_issue_password_reset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/accounts/{id}/account-recovery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description Active admin required; no other-account content access. */
        post: operations["admin_issue_recovery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Active admin required; no other-account content access. */
        get: operations["admin_diagnostics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/oauth/requests/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["web_get_oauth_consent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/oauth/requests/{id}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_decide_oauth_consent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/reauthenticate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["web_reauthenticate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** Format: uuid */
        Id: string;
        /** Format: date-time */
        Timestamp: string;
        Revision: string;
        Tag: {
            id: components["schemas"]["Id"];
            name: string;
        };
        Vault: {
            id: components["schemas"]["Id"];
            name: string;
        };
        WriteResult: {
            id: components["schemas"]["Id"];
            revision: components["schemas"]["Revision"];
            updatedAt: components["schemas"]["Timestamp"];
        };
        Error: {
            /** @enum {string} */
            code: "validation_failed" | "authentication_required" | "permission_denied" | "not_found" | "revision_conflict" | "idempotency_conflict" | "name_conflict" | "request_in_progress" | "cursor_expired" | "payload_too_large" | "rate_limited" | "temporarily_unavailable" | "internal_error" | "csrf_failed" | "reauthentication_required" | "flow_expired" | "import_expired" | "last_admin_required" | "smtp_unavailable";
            message: string;
            requestId: string;
            fields?: {
                field: string;
                message: string;
            }[];
            retryAfterSeconds?: number;
        } & unknown;
        ListVaultsInput: {
            /** @default 20 */
            pageSize: number;
            cursor?: string;
        };
        ListTagsInput: {
            vaultId: components["schemas"]["Id"];
            /** @default 20 */
            pageSize: number;
            cursor?: string;
        };
        GetMemoryInput: {
            id: components["schemas"]["Id"];
        };
        CreateMemoryInput: {
            vaultId: components["schemas"]["Id"];
            /** @description Validate after outer trimming; must not be empty. */
            title: string;
            /** @description Preserve text including line endings; at most 1048576 UTF-8 bytes. Byte limit requires application validation. */
            markdown: string;
            /** @description Empty string is normalized to null on input. */
            summary?: string | null;
            tagIds?: components["schemas"]["Id"][];
        };
        UpdateMemoryInput: {
            id: components["schemas"]["Id"];
            expectedRevision: components["schemas"]["Revision"];
            /** @description Validate after outer trimming; must not be empty. */
            title?: string;
            /** @description Preserve text including line endings; at most 1048576 UTF-8 bytes. Byte limit requires application validation. */
            markdown?: string;
            /** @description Empty string is normalized to null on input. */
            summary?: string | null;
            tagIds?: components["schemas"]["Id"][];
        };
        DeleteMemoryInput: {
            id: components["schemas"]["Id"];
            expectedRevision: components["schemas"]["Revision"];
        };
        CreateTagInput: {
            vaultId: components["schemas"]["Id"];
            name: string;
        };
        SearchInput: {
            vaultId?: components["schemas"]["Id"];
            /** @constant */
            allVaults?: true;
            /** @default  */
            query: string;
            tagIds?: components["schemas"]["Id"][];
            /**
             * @default all
             * @enum {string}
             */
            tagMatch: "all" | "any";
            /** @enum {string} */
            sort?: "relevance" | "updatedAt";
            /** @default 20 */
            pageSize: number;
            cursor?: string;
        } & (unknown | unknown);
        Memory: {
            id: components["schemas"]["Id"];
            vaultId: components["schemas"]["Id"];
            /** @description Validate after outer trimming; must not be empty. */
            title: string;
            /** @description Empty string is normalized to null on input. */
            summary: string | null;
            tags: components["schemas"]["Tag"][];
            revision: components["schemas"]["Revision"];
            createdAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
            /** @description Preserve text including line endings; at most 1048576 UTF-8 bytes. Byte limit requires application validation. */
            markdown: string;
        };
        SearchHit: {
            id: components["schemas"]["Id"];
            vaultId: components["schemas"]["Id"];
            /** @description Validate after outer trimming; must not be empty. */
            title: string;
            /** @description Empty string is normalized to null on input. */
            summary: string | null;
            tags: components["schemas"]["Tag"][];
            revision: components["schemas"]["Revision"];
            createdAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
            snippet: string;
        };
        VaultPage: {
            items: components["schemas"]["Vault"][];
            nextCursor: string | null;
        };
        TagPage: {
            items: components["schemas"]["Tag"][];
            nextCursor: string | null;
        };
        SearchPage: {
            items: components["schemas"]["SearchHit"][];
            nextCursor: string | null;
        };
        Ok: {
            /** @constant */
            ok: true;
        };
        Profile: {
            id: components["schemas"]["Id"];
            /** Format: email */
            email: string;
            /** @enum {string} */
            role: "user" | "admin";
            revision: components["schemas"]["Revision"];
            /** @enum {string} */
            theme: "dark" | "light" | "system";
            /** @enum {string} */
            language: "de" | "en";
            allowAgentTagCreation: boolean;
            totpEnabled: boolean;
            emailVerified: boolean;
            smtpEnabled: boolean;
        };
        ProfilePatch: {
            expectedRevision?: components["schemas"]["Revision"];
            /** @enum {string} */
            theme?: "dark" | "light" | "system";
            /** @enum {string} */
            language?: "de" | "en";
            allowAgentTagCreation?: boolean;
        } & unknown;
        Session: {
            id: components["schemas"]["Id"];
            browser: string;
            device: string;
            createdAt: components["schemas"]["Timestamp"];
            lastActiveAt: components["schemas"]["Timestamp"];
            expiresAt: components["schemas"]["Timestamp"];
            current: boolean;
        };
        WebVault: {
            id: components["schemas"]["Id"];
            name: string;
            revision: components["schemas"]["Revision"];
            /** @enum {string} */
            searchLanguage: "neutral" | "de" | "en";
            pendingSearchLanguage: ("neutral" | "de" | "en") | null;
            /** @default 20 */
            versionLimit: number;
            activeRecordCount: number;
            createdAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
        };
        WebTag: {
            id: components["schemas"]["Id"];
            name: string;
            revision: components["schemas"]["Revision"];
        };
        VaultCreate: {
            name: string;
            /** @enum {string} */
            searchLanguage?: "neutral" | "de" | "en";
            /** @default 20 */
            versionLimit: number;
        };
        VaultPatch: {
            expectedRevision: components["schemas"]["Revision"];
            name?: string;
            /** @enum {string} */
            searchLanguage?: "neutral" | "de" | "en";
            /** @default 20 */
            versionLimit: number;
        };
        ExpectedRevision: {
            expectedRevision: components["schemas"]["Revision"];
        };
        Grant: {
            vaultId: components["schemas"]["Id"];
            /** @enum {string} */
            level: "read" | "write" | "delete";
        };
        AgentAccess: {
            id: components["schemas"]["Id"];
            name: string;
            revision: components["schemas"]["Revision"];
            /** @enum {string} */
            kind: "cli" | "oauth";
            grants: components["schemas"]["Grant"][];
            createdAt: components["schemas"]["Timestamp"];
            lastUsedAt: components["schemas"]["Timestamp"] | null;
            clientId: string | null;
        };
        AgentCreate: {
            name: string;
            grants: components["schemas"]["Grant"][];
        };
        AgentPatch: {
            expectedRevision: components["schemas"]["Revision"];
            name?: string;
            grants?: components["schemas"]["Grant"][];
        };
        Credential: {
            id: components["schemas"]["Id"];
            createdAt: components["schemas"]["Timestamp"];
            expiresAt: components["schemas"]["Timestamp"] | null;
            lastUsedAt: components["schemas"]["Timestamp"] | null;
            revokedAt: components["schemas"]["Timestamp"] | null;
        };
        TokenCreate: {
            expectedRevision: components["schemas"]["Revision"];
            /**
             * @default 90
             * @enum {unknown}
             */
            lifetimeDays: 30 | 90 | 365 | null;
            replacesTokenId?: components["schemas"]["Id"];
            /** @default 0 */
            overlapSeconds: number;
        };
        TokenIssued: {
            credential: components["schemas"]["Credential"];
            /** @description Secret; no logs, URLs or persistent browser storage. */
            token: string;
            agentRevision: components["schemas"]["Revision"];
        };
        Actor: {
            /** @enum {string} */
            kind: "user" | "agent" | "import";
            id: components["schemas"]["Id"] | null;
            name: string;
        };
        Version: {
            revision: components["schemas"]["Revision"];
            /** @description Validate after outer trimming; must not be empty. */
            title: string;
            /** @description Empty string is normalized to null on input. */
            summary: string | null;
            /** @description Preserve text including line endings; at most 1048576 UTF-8 bytes. Byte limit requires application validation. */
            markdown: string;
            tagNames: string[];
            savedAt: components["schemas"]["Timestamp"];
            actor: components["schemas"]["Actor"];
        };
        VersionSummary: {
            revision: components["schemas"]["Revision"];
            savedAt: components["schemas"]["Timestamp"];
            actor: components["schemas"]["Actor"];
        };
        RestorePreview: {
            sourceRevision: components["schemas"]["Revision"];
            currentRevision: components["schemas"]["Revision"];
            /** @description Secret; no logs, URLs or persistent browser storage. */
            restoreToken: string;
            tagsToCreate: string[];
            tagsToReuse: components["schemas"]["WebTag"][];
        };
        TrashMemory: {
            id: components["schemas"]["Id"];
            vaultId: components["schemas"]["Id"];
            /** @description Validate after outer trimming; must not be empty. */
            title: string;
            revision: components["schemas"]["Revision"];
            deletedAt: components["schemas"]["Timestamp"];
            expiresAt: components["schemas"]["Timestamp"];
        };
        TrashVault: {
            id: components["schemas"]["Id"];
            name: string;
            revision: components["schemas"]["Revision"];
            deletedAt: components["schemas"]["Timestamp"];
            expiresAt: components["schemas"]["Timestamp"];
            recordCount: number;
        };
        ImportPreparation: {
            id: components["schemas"]["Id"];
            /** @enum {string} */
            state: "ready" | "completed";
            expiresAt: components["schemas"]["Timestamp"];
            suggestedName: string;
            recordCount: number;
            tagCount: number;
            /** @enum {string} */
            searchLanguage: "neutral" | "de" | "en";
            /** @default 20 */
            versionLimit: number;
            resultVaultId: components["schemas"]["Id"] | null;
        };
        Account: {
            id: components["schemas"]["Id"];
            /** Format: email */
            email: string;
            /** @enum {string} */
            role: "user" | "admin";
            /** @enum {string} */
            status: "active" | "suspended";
            revision: components["schemas"]["Revision"];
            totpEnabled: boolean;
            createdAt: components["schemas"]["Timestamp"];
        };
        AccountPatch: {
            expectedRevision: components["schemas"]["Revision"];
            /** @enum {string} */
            role?: "user" | "admin";
            /** @enum {string} */
            status?: "active" | "suspended";
            /** Format: email */
            email?: string;
        };
        Invitation: {
            id: components["schemas"]["Id"];
            /** Format: email */
            email: string;
            /** @enum {string} */
            role: "user" | "admin";
            createdAt: components["schemas"]["Timestamp"];
            expiresAt: components["schemas"]["Timestamp"];
            /** @enum {string} */
            status: "pending" | "redeemed" | "revoked" | "expired";
        };
        LinkIssued: {
            /**
             * Format: uri
             * @description One-time secret link; display only in issuing response.
             */
            url: string;
            expiresAt: components["schemas"]["Timestamp"];
            /** @enum {string} */
            delivery: "manual" | "sent" | "failed";
        };
        ReauthResult: {
            /** @description Secret; no logs, URLs or persistent browser storage. */
            proof: string;
            expiresAt: components["schemas"]["Timestamp"];
        };
        Factor: {
            /** @constant */
            kind: "totp";
            code: string;
        } | {
            /** @constant */
            kind: "recoveryCode";
            code: string;
        };
        LoginResult: {
            /** @constant */
            status: "authenticated";
            profile: components["schemas"]["Profile"];
        } | {
            /** @constant */
            status: "secondFactorRequired";
            expiresAt: components["schemas"]["Timestamp"];
        };
        RecoveryCodes: {
            codes: string[];
        };
        ActionRequest: {
            /** @constant */
            operationId: "web_update_profile";
            path: Record<string, never>;
            query: Record<string, never>;
            body: components["schemas"]["ProfilePatch"];
        } | {
            /** @constant */
            operationId: "web_delete_account";
            path: Record<string, never>;
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            body: null;
        } | {
            /** @constant */
            operationId: "web_setup_totp";
            path: Record<string, never>;
            query: Record<string, never>;
            body: Record<string, never>;
        } | {
            /** @constant */
            operationId: "web_disable_totp";
            path: Record<string, never>;
            query: Record<string, never>;
            body: Record<string, never>;
        } | {
            /** @constant */
            operationId: "web_replace_recovery_codes";
            path: Record<string, never>;
            query: Record<string, never>;
            body: Record<string, never>;
        } | {
            /** @constant */
            operationId: "web_create_agent_access";
            path: Record<string, never>;
            query: Record<string, never>;
            body: components["schemas"]["AgentCreate"];
        } | {
            /** @constant */
            operationId: "web_update_agent_access";
            path: {
                id: components["schemas"]["Id"];
            };
            query: Record<string, never>;
            body: components["schemas"]["AgentPatch"];
        } | {
            /** @constant */
            operationId: "web_issue_token";
            path: {
                id: components["schemas"]["Id"];
            };
            query: Record<string, never>;
            body: components["schemas"]["TokenCreate"];
        } | {
            /** @constant */
            operationId: "admin_update_account";
            path: {
                id: components["schemas"]["Id"];
            };
            query: Record<string, never>;
            body: components["schemas"]["AccountPatch"];
        } | {
            /** @constant */
            operationId: "admin_delete_account";
            path: {
                id: components["schemas"]["Id"];
            };
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            body: null;
        } | {
            /** @constant */
            operationId: "admin_invite";
            path: Record<string, never>;
            query: Record<string, never>;
            body: {
                /** Format: email */
                email: string;
                /** @enum {string} */
                role: "user" | "admin";
                sendEmail?: boolean;
            };
        } | {
            /** @constant */
            operationId: "admin_issue_recovery";
            path: {
                id: components["schemas"]["Id"];
            };
            query: Record<string, never>;
            body: {
                expectedRevision: components["schemas"]["Revision"];
                sendEmail?: boolean;
            };
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    web_list_vaults: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["WebVault"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_create_vault: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VaultCreate"];
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebVault"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_list_tags: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                vaultId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["WebTag"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_create_tag: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                vaultId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebTag"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_search_memories: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    vaultId?: components["schemas"]["Id"];
                    /** @constant */
                    allVaults?: true;
                    /** @default  */
                    query?: string;
                    tagIds?: components["schemas"]["Id"][];
                    /**
                     * @default all
                     * @enum {string}
                     */
                    tagMatch?: "all" | "any";
                    /** @enum {string} */
                    sort?: "relevance" | "updatedAt";
                    /** @default 20 */
                    pageSize?: number;
                    cursor?: string;
                } & (unknown | unknown);
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchPage"];
                };
            };
            /** @description Product error; see API_CONTRACT.md for status/code mapping. */
            default: {
                headers: {
                    /** @description For request_in_progress: 1 second; mirrors retryAfterSeconds. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_get_memory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Memory"];
                };
            };
            /** @description Product error; see API_CONTRACT.md for status/code mapping. */
            default: {
                headers: {
                    /** @description For request_in_progress: 1 second; mirrors retryAfterSeconds. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_delete_memory: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header?: {
                "Idempotency-Key"?: string;
            };
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WriteResult"];
                };
            };
            /** @description Product error; see API_CONTRACT.md for status/code mapping. */
            default: {
                headers: {
                    /** @description For request_in_progress: 1 second; mirrors retryAfterSeconds. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_update_memory: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
            };
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: components["schemas"]["Revision"];
                    /** @description Validate after outer trimming; must not be empty. */
                    title?: string;
                    /** @description Preserve text including line endings; at most 1048576 UTF-8 bytes. Byte limit requires application validation. */
                    markdown?: string;
                    /** @description Empty string is normalized to null on input. */
                    summary?: string | null;
                    tagIds?: components["schemas"]["Id"][];
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WriteResult"];
                };
            };
            /** @description Product error; see API_CONTRACT.md for status/code mapping. */
            default: {
                headers: {
                    /** @description For request_in_progress: 1 second; mirrors retryAfterSeconds. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_create_memory: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    vaultId: components["schemas"]["Id"];
                    /** @description Validate after outer trimming; must not be empty. */
                    title: string;
                    /** @description Preserve text including line endings; at most 1048576 UTF-8 bytes. Byte limit requires application validation. */
                    markdown: string;
                    /** @description Empty string is normalized to null on input. */
                    summary?: string | null;
                    tagIds?: components["schemas"]["Id"][];
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WriteResult"];
                };
            };
            /** @description Product error; see API_CONTRACT.md for status/code mapping. */
            default: {
                headers: {
                    /** @description For request_in_progress: 1 second; mirrors retryAfterSeconds. */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_get_csrf: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Secret; no logs, URLs or persistent browser storage. */
                        requestToken: string;
                        /** @constant */
                        headerName: "X-CSRF-Token";
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_setup_status: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        setupRequired: boolean;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_setup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    setupSecret: string;
                    /** Format: email */
                    email: string;
                    password: string;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Profile"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    password: string;
                    rememberMe?: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResult"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_login_factor: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    factor: components["schemas"]["Factor"];
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Profile"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_get_profile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Profile"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_delete_account: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_update_profile: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProfilePatch"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Profile"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_list_sessions: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Session"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_revoke_session: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_revoke_other_sessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_change_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    currentPassword: string;
                    newPassword: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_request_email_change: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    currentPassword: string;
                    /** Format: email */
                    newEmail: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_confirm_email: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    token: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_redeem_invitation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    token: string;
                    password: string;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Profile"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_request_password_reset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_redeem_password_reset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    token: string;
                    newPassword: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_redeem_recovery: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    token: string;
                    newPassword: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_setup_totp: {
        parameters: {
            query?: never;
            header: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        setupId: components["schemas"]["Id"];
                        /** @description Secret; no logs, URLs or persistent browser storage. */
                        secret: string;
                        /** Format: uri */
                        otpauthUri: string;
                        expiresAt: components["schemas"]["Timestamp"];
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_confirm_totp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    setupId: components["schemas"]["Id"];
                    code: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecoveryCodes"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_disable_totp: {
        parameters: {
            query?: never;
            header: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_replace_recovery_codes: {
        parameters: {
            query?: never;
            header: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecoveryCodes"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_get_vault: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebVault"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_delete_vault: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WriteResult"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_update_vault: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VaultPatch"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebVault"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_delete_tag: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header?: never;
            path: {
                vaultId: components["schemas"]["Id"];
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_rename_tag: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                vaultId: components["schemas"]["Id"];
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: components["schemas"]["Revision"];
                    name: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebTag"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_merge_tags: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                vaultId: components["schemas"]["Id"];
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: components["schemas"]["Revision"];
                    targetTagId: components["schemas"]["Id"];
                    expectedTargetRevision: components["schemas"]["Revision"];
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebTag"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_move_memory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: components["schemas"]["Revision"];
                    targetVaultId: components["schemas"]["Id"];
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WriteResult"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_list_versions: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["VersionSummary"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_get_version: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
                revision: components["schemas"]["Revision"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Version"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_preview_restore: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
                revision: components["schemas"]["Revision"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RestorePreview"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_restore_version: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: components["schemas"]["Revision"];
                    sourceRevision: components["schemas"]["Revision"];
                    restoreToken: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WriteResult"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_list_trashed_vaults: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["TrashVault"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_list_trashed_memories: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["TrashMemory"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_restore_vaults: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExpectedRevision"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WriteResult"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_purge_vaults: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_restore_memories: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExpectedRevision"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WriteResult"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_purge_memories: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_list_agent_accesses: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["AgentAccess"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_create_agent_access: {
        parameters: {
            query?: never;
            header: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AgentCreate"];
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentAccess"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_get_agent_access: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentAccess"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_delete_agent_access: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_update_agent_access: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof"?: string;
            };
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AgentPatch"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentAccess"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_list_tokens: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Credential"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_issue_token: {
        parameters: {
            query?: never;
            header: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof": string;
            };
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TokenCreate"];
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenIssued"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_revoke_token: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header?: never;
            path: {
                id: components["schemas"]["Id"];
                tokenId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_export_vault: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/zip": string;
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_prepare_import: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /**
                     * Format: binary
                     * @description ZIP, max 100 MiB compressed and 500 MiB expanded, 10000 records.
                     */
                    archive: string;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportPreparation"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_get_import: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ImportPreparation"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_cancel_import: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_commit_import: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    preparationId: components["schemas"]["Id"];
                    targetName: string;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebVault"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_list_accounts: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Account"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_delete_account: {
        parameters: {
            query: {
                expectedRevision: components["schemas"]["Revision"];
            };
            header: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof": string;
            };
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_update_account: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof"?: string;
            };
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountPatch"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Account"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_list_invitations: {
        parameters: {
            query?: {
                pageSize?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Invitation"][];
                        nextCursor: string | null;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_invite: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    /** @enum {string} */
                    role: "user" | "admin";
                    sendEmail?: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        invitation: components["schemas"]["Invitation"];
                        link: components["schemas"]["LinkIssued"];
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_revoke_invitation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_issue_password_reset: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: components["schemas"]["Revision"];
                    sendEmail?: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinkIssued"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_issue_recovery: {
        parameters: {
            query?: never;
            header: {
                /** @description Required for the sensitive action or rights expansion; see WEB_PROTOCOL.md. */
                "X-Action-Proof": string;
            };
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: components["schemas"]["Revision"];
                    sendEmail?: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinkIssued"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    admin_diagnostics: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        version: string;
                        databaseReady: boolean;
                        databaseBytes: number;
                        temporaryBytes: number;
                        uptimeSeconds: number;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_get_oauth_consent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: components["schemas"]["Id"];
                        clientName: string;
                        /** Format: uri */
                        clientId: string;
                        /** Format: uri */
                        resource: string;
                        requestedScopes: ("memory:read" | "memory:write" | "memory:delete")[];
                        expiresAt: components["schemas"]["Timestamp"];
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_decide_oauth_consent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @constant */
                    decision: "deny";
                } | {
                    /** @constant */
                    decision: "approve";
                    name: string;
                    grants: components["schemas"]["Grant"][];
                    scopes: ("memory:read" | "memory:write" | "memory:delete")[];
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uri
                         * @description Server-validated callback with code/error, state if supplied, and iss.
                         */
                        redirectUrl: string;
                    };
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    web_reauthenticate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    password: string;
                    factor?: components["schemas"]["Factor"];
                    request: components["schemas"]["ActionRequest"];
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReauthResult"];
                };
            };
            /** @description Product error; see WEB_PROTOCOL.md. */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}
