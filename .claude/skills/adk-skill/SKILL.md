---
name: adk-skill
description: Teaches AI agents how to correctly implement the Google Agent Development Kit (ADK) in Python.
---

## Description

This skill enables AI agents to correctly implement the Google Agent
Development Kit (ADK) in Python. It provides Python-specific context,
patterns, and best practices for building ADK agents.

## High-Level Architecture

The ADK provides a unified framework for building AI agents, centered around
these core concepts:

1. **Agents**: Autonomous entities (`LlmAgent`) that observe the world and act
   upon it using tools.
1. **Workflow Agents**: Deterministic controllers (`SequentialAgent`,
   `ParallelAgent`, `LoopAgent`) for orchestration.
1. **Model Context Protocol (MCP)**: A standard for connecting AI models to
   data and tools.
1. **Sessions & Memory**: Mechanisms for managing short-term conversation
   context and long-term user recall.

## Usage

This skill is Python-only. For all ADK tasks, refer to
`references/adk-python.md` for the authoritative Python-specific context,
patterns, and APIs.
