from __future__ import annotations

from typing import TypedDict


class FloodGuardSupportContact(TypedDict):
    name: str
    phone: str


FLOODGUARD_HELP_CONTACTS: tuple[FloodGuardSupportContact, ...] = (
    {"name": "Nabin Nepali", "phone": "9829592158"},
    {"name": "Rajesh Sapkota", "phone": "+977 986-6055433"},
    {"name": "Ayushree Lamichhane", "phone": "+977 986-6499607"},
    {"name": "Prinsa Khadgi", "phone": "+977 981-8112855"},
)


def get_support_contacts() -> list[FloodGuardSupportContact]:
    """Return a copy so callers cannot mutate the central contact list."""
    return [dict(contact) for contact in FLOODGUARD_HELP_CONTACTS]


def format_support_contacts() -> str:
    lines = ["FloodGuard Support Contacts", ""]
    for contact in FLOODGUARD_HELP_CONTACTS:
        lines.extend((contact["name"], contact["phone"], ""))
    return "\n".join(lines).rstrip()
