"""
Azure Authentication Engine
Implements real Microsoft Entra ID (Azure AD) OAuth2 token exchange via client credentials flow.
Direct ARM token acquisition and subscription validation without heavy third-party dependencies.
FAILS CLOSED: Never generates synthetic or simulated credentials on live paths.
"""

import json
import logging
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger("cloudpilot.azure_auth")


class AzureAuthError(Exception):
    """Base exception for Azure authentication errors."""
    pass


class AzureTokenError(AzureAuthError):
    """Raised when Microsoft Entra ID rejects client credentials."""
    pass


class AzureSubscriptionError(AzureAuthError):
    """Raised when target Azure subscription cannot be verified or accessed."""
    pass


class AzureTokenCache:
    """In-memory cache for Azure Bearer tokens with automated pre-expiry invalidation."""
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[str]:
        entry = self._cache.get(key)
        if not entry:
            return None
        # Invalidate 5 minutes (300s) before actual expiry
        if entry["expires_at"] - time.time() < 300:
            del self._cache[key]
            return None
        return entry["access_token"]

    def set(self, key: str, token: str, expires_in_seconds: int):
        self._cache[key] = {
            "access_token": token,
            "expires_at": time.time() + expires_in_seconds
        }

    def clear(self):
        self._cache.clear()


azure_token_cache = AzureTokenCache()


def get_azure_oauth_token(
    tenant_id: str,
    client_id: str,
    client_secret: str,
    resource: str = "https://management.azure.com/"
) -> str:
    """
    Acquires an Azure Bearer token using OAuth2 Client Credentials grant:
    POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
    """
    if not tenant_id or not client_id or not client_secret:
        raise AzureTokenError("Missing required Azure credentials: tenant_id, client_id, and client_secret are required.")

    cache_key = f"{tenant_id}:{client_id}"
    cached_token = azure_token_cache.get(cache_key)
    if cached_token:
        logger.info(f"[AzureAuth] Reusing cached verified Bearer token for client {client_id[:8]}...")
        return cached_token

    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": f"{resource.rstrip('/')}/.default"
    }

    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        token_url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            access_token = body.get("access_token")
            expires_in = int(body.get("expires_in", 3600))
            if not access_token:
                raise AzureTokenError("Microsoft Entra ID token response missing 'access_token'.")
            
            azure_token_cache.set(cache_key, access_token, expires_in)
            logger.info(f"[AzureAuth] Successfully acquired Azure Bearer token for client {client_id[:8]}... (expires in {expires_in}s)")
            return access_token

    except urllib.error.HTTPError as e:
        error_detail = e.read().decode("utf-8", errors="ignore")
        logger.error(f"[AzureAuth] OAuth2 token exchange rejected by Microsoft Entra ID ({e.code}): {error_detail}")
        try:
            err_json = json.loads(error_detail)
            error_desc = err_json.get("error_description", err_json.get("error", str(e)))
        except Exception:
            error_desc = error_detail or str(e)
        raise AzureTokenError(f"Azure authentication rejected ({e.code}): {error_desc}") from e

    except Exception as e:
        logger.error(f"[AzureAuth] Network error communicating with Microsoft identity platform: {e}")
        raise AzureTokenError(f"Failed to communicate with Azure identity platform: {str(e)}") from e


def verify_azure_subscription(
    subscription_id: str,
    access_token: str
) -> Dict[str, Any]:
    """
    Validates that the Service Principal has access to target subscription:
    GET https://management.azure.com/subscriptions/{subscription_id}?api-version=2020-01-01
    """
    sub_clean = subscription_id.strip().strip("{}")
    url = f"https://management.azure.com/subscriptions/{sub_clean}?api-version=2020-01-01"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        method="GET"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            display_name = data.get("displayName", f"Azure Subscription ({sub_clean[:8]})")
            state = data.get("state", "Enabled")
            logger.info(f"[AzureAuth] Verified Azure subscription '{display_name}' ({sub_clean}) - State: {state}")
            return {
                "subscription_id": sub_clean,
                "display_name": display_name,
                "state": state,
                "verified_at": datetime.now(timezone.utc).isoformat()
            }

    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        logger.error(f"[AzureAuth] Subscription verification failed ({e.code}): {err_msg}")
        raise AzureSubscriptionError(f"Azure subscription verification failed ({e.code}): {err_msg}") from e

    except Exception as e:
        logger.error(f"[AzureAuth] Error verifying subscription {sub_clean}: {e}")
        raise AzureSubscriptionError(f"Failed to verify Azure subscription: {str(e)}") from e


def connect_azure_account(
    tenant_id: str,
    client_id: str,
    client_secret: str,
    subscription_id: str
) -> Dict[str, Any]:
    """
    Executes full Azure Service Principal authentication and subscription verification.
    FAILS CLOSED: Raises AzureAuthError on any validation issue.
    """
    token = get_azure_oauth_token(tenant_id, client_id, client_secret)
    sub_info = verify_azure_subscription(subscription_id, token)

    return {
        "cloud_provider": "azure",
        "subscription_id": sub_info["subscription_id"],
        "display_name": sub_info["display_name"],
        "tenant_id": tenant_id,
        "client_id": client_id,
        "is_live": True,
        "execution_mode": "live",
        "connection_status": "connected",
        "verified_at": sub_info["verified_at"]
    }
