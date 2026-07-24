#!/usr/bin/env python
"""Repo-root entry point so Heroku's Python buildpack finds manage.py.

The Django project lives in backend/; this shim puts it on the path and
delegates every management command (migrate, collectstatic, ...) to it.
"""
import os
import sys

BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, BACKEND)


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
