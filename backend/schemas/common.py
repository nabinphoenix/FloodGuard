from pydantic import BaseModel, field_validator


class NormalizedModel(BaseModel):
    """Trim user-entered text before Pydantic length/pattern validation."""

    @field_validator(
        "name",
        "email",
        "phone",
        "district",
        "description",
        "message",
        "reason",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def strip_text_fields(cls, value, info):
        if not isinstance(value, str):
            return value
        value = value.strip()
        if info.field_name == "phone" and value == "":
            return None
        return value

    @field_validator("email", mode="after", check_fields=False)
    @classmethod
    def lowercase_email(cls, value):
        return None if value is None else str(value).lower()
