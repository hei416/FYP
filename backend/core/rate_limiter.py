"""
Rate limiting configuration for CodeTutor API.

This module centralizes rate limiter setup to avoid circular imports
when the limiter is used in routers.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Singleton limiter instance — import this in main.py and routers
limiter = Limiter(key_func=get_remote_address)
