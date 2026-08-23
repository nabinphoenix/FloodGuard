from unittest.mock import MagicMock

from botocore.exceptions import ClientError

from scripts.fix_oversized_optimized_images import repair_oversized_objects


class FakeS3:

    def __init__(self, sizes):
        self.sizes = sizes
        self.copy_object = MagicMock()

    def get_paginator(self, name):
        assert name == "list_objects_v2"
        return MagicMock(paginate=lambda **kwargs: [{"Contents": [{"Key": key} for key in self.sizes]}])

    def head_object(self, Bucket, Key):
        if Key not in self.sizes:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        return self.sizes[Key]


def test_dry_run_reports_oversized_pair_without_modifying():
    s3 = FakeS3({
        "original/incident-reports/a.jpg": {"ContentLength": 100, "ContentType": "image/jpeg", "Metadata": {}},
        "optimized/incident-reports/a.jpg": {"ContentLength": 120},
    })

    checked, changed = repair_oversized_objects(s3, "bucket", dry_run=True)

    assert (checked, changed) == (1, 1)
    s3.copy_object.assert_not_called()


def test_apply_copies_original_bytes_and_content_type_metadata():
    s3 = FakeS3({
        "original/incident-reports/a.jpg": {
            "ContentLength": 100,
            "ContentType": "image/jpeg",
            "Metadata": {"source": "citizen-report"},
            "CacheControl": "max-age=60",
        },
        "optimized/incident-reports/a.jpg": {"ContentLength": 120},
    })

    checked, changed = repair_oversized_objects(s3, "bucket", dry_run=False)

    assert (checked, changed) == (1, 1)
    s3.copy_object.assert_called_once_with(
        Bucket="bucket",
        Key="optimized/incident-reports/a.jpg",
        CopySource={"Bucket": "bucket", "Key": "original/incident-reports/a.jpg"},
        ContentType="image/jpeg",
        Metadata={"source": "citizen-report"},
        MetadataDirective="REPLACE",
        CacheControl="max-age=60",
    )


def test_smaller_or_equal_optimized_pairs_are_unchanged():
    s3 = FakeS3({
        "original/incident-reports/smaller.jpg": {"ContentLength": 100, "ContentType": "image/jpeg", "Metadata": {}},
        "optimized/incident-reports/smaller.jpg": {"ContentLength": 80},
        "original/incident-reports/equal.jpg": {"ContentLength": 100, "ContentType": "image/jpeg", "Metadata": {}},
        "optimized/incident-reports/equal.jpg": {"ContentLength": 100},
    })

    checked, changed = repair_oversized_objects(s3, "bucket", dry_run=False)

    assert (checked, changed) == (2, 0)
    s3.copy_object.assert_not_called()
