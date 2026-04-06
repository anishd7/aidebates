import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DebateStatus from "@/components/debate/DebateStatus";
import type { AgentConfig } from "@/types";

const agentA: AgentConfig = {
  name: "Pro Regulation",
  personality: "Argues for AI regulation",
  provider: "openai",
  model: "gpt-4.1",
};

const agentB: AgentConfig = {
  name: "Anti Regulation",
  personality: "Argues against AI regulation",
  provider: "anthropic",
  model: "claude-sonnet-4",
};

describe("DebateStatus", () => {
  it("renders debate topic in quotes", () => {
    render(
      <DebateStatus
        topic="Should AI be regulated?"
        status="running"
        currentTurn={5}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(
      screen.getByText(/Should AI be regulated\?/)
    ).toBeTruthy();
  });

  it("displays running status with label", () => {
    render(
      <DebateStatus
        topic="Test topic"
        status="running"
        currentTurn={3}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("displays paused status with label", () => {
    render(
      <DebateStatus
        topic="Test topic"
        status="paused"
        currentTurn={7}
        maxTurns={20}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(screen.getByText("Paused")).toBeTruthy();
  });

  it("displays completed status with label", () => {
    render(
      <DebateStatus
        topic="Test topic"
        status="completed"
        currentTurn={10}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("displays created status with label", () => {
    render(
      <DebateStatus
        topic="Test topic"
        status="created"
        currentTurn={0}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("shows turn counter", () => {
    render(
      <DebateStatus
        topic="Test topic"
        status="running"
        currentTurn={12}
        maxTurns={100}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(screen.getByText("Turn 12/100")).toBeTruthy();
  });

  it("shows agent A info with model", () => {
    render(
      <DebateStatus
        topic="Test topic"
        status="running"
        currentTurn={1}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(screen.getByText("Pro Regulation")).toBeTruthy();
    expect(screen.getByText("(gpt-4.1)")).toBeTruthy();
  });

  it("shows agent B info with model", () => {
    render(
      <DebateStatus
        topic="Test topic"
        status="running"
        currentTurn={1}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(screen.getByText("Anti Regulation")).toBeTruthy();
    expect(screen.getByText("(claude-sonnet-4)")).toBeTruthy();
  });

  it("shows vs separator between agents", () => {
    render(
      <DebateStatus
        topic="Test topic"
        status="running"
        currentTurn={1}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    expect(screen.getByText("vs")).toBeTruthy();
  });

  it("applies pulse animation for running status", () => {
    const { container } = render(
      <DebateStatus
        topic="Test topic"
        status="running"
        currentTurn={1}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    const pulsingElement = container.querySelector(".animate-pulse");
    expect(pulsingElement).not.toBeNull();
  });

  it("does not apply pulse animation for non-running statuses", () => {
    const { container } = render(
      <DebateStatus
        topic="Test topic"
        status="completed"
        currentTurn={10}
        maxTurns={10}
        agentAConfig={agentA}
        agentBConfig={agentB}
      />
    );
    const pulsingElement = container.querySelector(".animate-pulse");
    expect(pulsingElement).toBeNull();
  });
});
