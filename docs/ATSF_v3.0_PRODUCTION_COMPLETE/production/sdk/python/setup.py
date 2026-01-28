"""
ATSF SDK - Setup Configuration
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="atsf-sdk",
    version="3.0.0",
    author="ATSF Development Team",
    author_email="dev@agentanchorai.com",
    description="Official Python SDK for the Agentic Trust Scoring Framework",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/agentanchor/atsf-sdk",
    project_urls={
        "Documentation": "https://docs.agentanchorai.com/atsf",
        "Bug Tracker": "https://github.com/agentanchor/atsf-sdk/issues",
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Security",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "requests>=2.28.0",
    ],
    extras_require={
        "async": ["aiohttp>=3.8.0"],
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "atsf=atsf:main",
        ],
    },
)
