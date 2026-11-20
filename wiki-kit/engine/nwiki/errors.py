"""Parse / render errors with location hints."""

from __future__ import annotations


class NwikiError(Exception):
    def __init__(self, message: str, *, index: int | None = None) -> None:
        self.index = index
        suffix = f" (at {index})" if index is not None else ""
        super().__init__(message + suffix)
