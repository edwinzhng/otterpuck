import { z } from "zod";
import { getElement } from "../dom";
import {
  defaultFormation,
  formationChoices,
  sizeLabel,
  TEAM_SIZES,
} from "../positions";
import {
  SWIM_TURNS,
  type SwimTurn,
  savedSwimTurn,
  saveSwimTurn,
  swimTurnChoice,
} from "../swim-turn";
import type { BotDifficulty, Controls, Handedness, Simulation } from "../types";
import { button, dialog, field } from "../ui-components";
import { connectRoom, type Session } from "./client";
import { customPlayerName } from "./names";
import { PROTOCOL, type RoomView } from "./protocol";
import { loadRegions, measurePing, type Region } from "./regions";

const DIFFICULTIES: readonly (readonly [BotDifficulty, string])[] = [
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
  ["elite", "Elite"],
];
export const multiplayerMarkup = (): string =>
  dialog(
    "multiplayer-dialog",
    "Play with friends",
    `
 <div id="mp-setup">
 <div class="mp-switch" role="group" aria-label="Room action">
 ${button("mp-create-tab", "Create", "secondary", 'aria-pressed="true"')}
 ${button("mp-join-tab", "Join", "secondary", 'aria-pressed="false"')}
 </div>
 <div id="mp-join-fields" hidden><label class="field">Room code<input id="mp-code" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234"/></label></div>
 <details class="mp-disclosure" id="mp-region-picker"><summary><span>Server</span><strong id="mp-region-summary">Loading…</strong></summary>
 <fieldset id="mp-regions"><legend class="mp-sr-only">Server region</legend></fieldset>
 ${button("mp-ping", "Refresh ping", "secondary")}</details>
 <p id="mp-mode-help" hidden>Keep the host device awake on the same Wi-Fi, with internet needed to join.</p>
 <div class="mp-actions">${button("mp-create", "Create room", "primary")}${button("mp-join", "Join room", "primary", "hidden")}</div>
 </div>
 <section id="mp-room" hidden>
 <div class="mp-room-scroll">
 <div class="mp-room-bar"><div><span class="mp-field-label">Room code</span><h3 id="mp-room-title"></h3></div><div class="mp-room-meta"><p id="mp-room-region"></p>${button("mp-copy", "Copy invite")}</div></div>
 <div class="mp-player-bar"><label class="field" for="mp-name"><span>Your name</span><input id="mp-name" maxlength="24" placeholder="Player" autocomplete="nickname"/></label>${field(
   "mp-team-size",
   "Match size",
   TEAM_SIZES.map((size): [string, string] => [String(size), sizeLabel(size)]),
 )}${field(
   "mp-swim-turn",
   "Turn rate",
   SWIM_TURNS.map((turn): [string, string] => [String(turn), `${turn}×`]),
 )}${field("mp-difficulty", "Bots", DIFFICULTIES)}<p>Choose a team and a position.</p></div>
 <div class="mp-teams" id="mp-teams"></div>
 </div>
 <div class="mp-room-footer"><span id="mp-waiting" class="mp-room-hint">Empty positions are filled by bots.</span><div class="mp-actions">${button("mp-leave", "Leave", "secondary")}${button("mp-start", "Start match", "primary")}</div></div>
 </section>
 <p id="mp-status" role="status" aria-live="polite" hidden></p>
 `,
    "close-multiplayer",
  );
export const bindMultiplayer = (callbacks: {
  handedness: () => Handedness;
  play: (state: Simulation) => void;
  state: (state: Simulation) => void;
  ended: () => void;
}): {
  active: () => boolean;
  handedness: (value: Handedness) => void;
  input: (controls: Controls, seconds?: number) => void;
  cancelInput: () => void;
  frame: () => void;
  alpha: () => number;
  leave: () => void;
} => {
  const modal = getElement("#multiplayer-dialog", HTMLDialogElement);
  const status = getElement("#mp-status", HTMLElement);
  const regionList = getElement("#mp-regions", HTMLElement);
  let regions: Region[] = [];
  let selected = "";
  const pings = new Map<string, number>();
  let regionChosen = false;
  let session: Session | undefined;
  let started = false;
  let connection: "online" | "lan" = "online";
  let hosting = false;
  let assignedName = "";
  let preferredSwimTurn: SwimTurn | undefined;
  let customName: string | undefined;
  try {
    const legacy = localStorage.getItem("otterpuck-name");
    customName = customPlayerName(
      localStorage.getItem("otterpuck-player-name") ??
        (legacy === "Swimmer" ? undefined : legacy),
    );
    if (customName) localStorage.setItem("otterpuck-player-name", customName);
    else localStorage.removeItem("otterpuck-player-name");
    localStorage.removeItem("otterpuck-name");
  } catch {}
  getElement("#mp-name", HTMLInputElement).value = customName ?? "";
  const badge = getElement("#network-status", HTMLElement);
  const latency = getElement("#network-ping", HTMLElement);
  let intent: "create" | "join" = "create";
  const chooseIntent = (next: "create" | "join"): void => {
    intent = next;
    getElement("#mp-join-fields", HTMLElement).hidden = next !== "join";
    getElement("#mp-region-picker", HTMLDetailsElement).hidden =
      next === "join";
    getElement("#mp-create", HTMLElement).hidden = next !== "create";
    getElement("#mp-join", HTMLElement).hidden = next !== "join";
    getElement("#mp-create-tab", HTMLElement).setAttribute(
      "aria-pressed",
      String(next === "create"),
    );
    getElement("#mp-join-tab", HTMLElement).setAttribute(
      "aria-pressed",
      String(next === "join"),
    );
    status.hidden = true;
  };
  const updateRegion = (): void => {
    const region = regions.find((r) => r.id === selected);
    const summary = getElement("#mp-region-summary", HTMLElement);
    const label =
      connection === "lan"
        ? "Local Network"
        : (region?.label ?? "Choose server");
    const milliseconds =
      connection === "online" && region ? pings.get(region.id) : undefined;
    summary.replaceChildren(label);
    if (milliseconds !== undefined) {
      const ping = document.createElement("span");
      ping.className = "mp-region-ping";
      ping.textContent = ` · ${milliseconds} ms`;
      summary.append(ping);
      summary.dataset.quality =
        milliseconds < 100 ? "good" : milliseconds < 180 ? "fair" : "poor";
    } else delete summary.dataset.quality;
    getElement("#network-region", HTMLElement).textContent =
      connection === "lan" ? "Local Network" : (region?.label ?? "Connecting");
    getElement("#mp-mode-help", HTMLElement).hidden = connection !== "lan";
  };
  const setStatus = (text: string): void => {
    const routine = [
      "Match connected",
      "Direct connection ready",
      "Connected to room service",
      "Room ready. Share the code or invite link.",
    ].includes(text);
    status.textContent = routine ? "" : text;
    status.hidden = routine || !text;
    const issue = getElement("#network-issue", HTMLElement);
    issue.textContent = routine ? "" : text;
    issue.hidden = routine || !text;
    if (/lost|Waiting|Reconnecting|Could not/i.test(text)) {
      latency.textContent = "—";
      badge.dataset.quality = "waiting";
    }
  };
  const teams = getElement("#mp-teams", HTMLElement);
  const lock = (locked: boolean): void => {
    for (const id of ["mp-create", "mp-join", "mp-code"]) {
      const element = getElement(`#${id}`, HTMLElement);
      if (
        element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement
      )
        element.disabled = locked;
    }
    for (const input of regionList.querySelectorAll("input"))
      input.disabled =
        locked ||
        (input.value !== "lan" &&
          !regions.find((region) => region.id === input.value)?.url);
  };
  const leave = (): void => {
    session?.leave();
    session = undefined;
    started = false;
    badge.hidden = true;
    getElement("#mp-setup", HTMLElement).hidden = false;
    modal.classList.remove("mp-lobby");
    getElement("#multiplayer-dialog > header h2", HTMLElement).textContent =
      "Play with friends";
    lock(false);
    getElement("#mp-room", HTMLElement).hidden = true;
  };
  const updateRoom = (room: RoomView, self: string): void => {
    lock(true);
    getElement("#mp-setup", HTMLElement).hidden = true;
    modal.classList.add("mp-lobby");
    getElement("#multiplayer-dialog > header h2", HTMLElement).textContent =
      room.phase === "waiting" ? "Waiting room" : "Your room";
    connection = room.mode;
    updateRegion();
    hosting = room.mode === "lan" && room.hostId === self;
    if (hosting) latency.textContent = "0 ms (Host)";
    for (const radio of regionList.querySelectorAll("input"))
      radio.checked = radio.value === (connection === "lan" ? "lan" : selected);
    getElement("#mp-room", HTMLElement).hidden = false;
    getElement("#mp-room-title", HTMLElement).textContent = room.code;
    getElement("#mp-room-region", HTMLElement).textContent =
      room.mode === "lan"
        ? "Local Network"
        : (regions.find((r) => r.id === selected)?.label ?? selected);
    const locked = room.hostId !== self || room.phase !== "waiting";
    const size = getElement("#mp-team-size", HTMLSelectElement);
    size.value = String(room.teamSize);
    size.dispatchEvent(new Event("input"));
    size.disabled = locked;
    if (!locked && preferredSwimTurn !== undefined) {
      if (preferredSwimTurn !== room.swimTurn)
        session?.settings({ swimTurn: preferredSwimTurn });
      preferredSwimTurn = undefined;
    }
    const swimTurn = getElement("#mp-swim-turn", HTMLSelectElement);
    swimTurn.value = String(room.swimTurn);
    swimTurn.dispatchEvent(new Event("input"));
    swimTurn.disabled = locked;
    const difficulty = getElement("#mp-difficulty", HTMLSelectElement);
    difficulty.value = room.difficulty;
    difficulty.dispatchEvent(new Event("input"));
    difficulty.disabled = locked;
    const me = room.members.find((member) => member.id === self);
    assignedName = me?.name ?? "";
    const name = getElement("#mp-name", HTMLInputElement);
    name.disabled = room.phase !== "waiting";
    if (me && document.activeElement !== name) name.value = me.name;
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.seat
        : undefined;
    const seats = formationChoices(defaultFormation(room.teamSize));
    teams.replaceChildren(
      ...([0, 1] as const).map((team) => {
        const side = document.createElement("section");
        side.className = "mp-team-side";
        side.dataset.team = String(team);
        side.dataset.selected = String(
          me && Math.floor(me.playerId / 6) === team,
        );
        const members = room.members.filter(
          (member) => Math.floor(member.playerId / 6) === team,
        );
        const header = document.createElement("button");
        header.type = "button";
        header.className = "mp-team-title";
        header.textContent = `${team === 0 ? "Otters" : "Beavers"} · ${members.length}/6`;
        header.setAttribute("aria-pressed", side.dataset.selected);
        const available = formationChoices("2-3-1").find(
          (position) =>
            !room.members.some(
              (member) => member.playerId === team * 6 + position.slot,
            ),
        );
        header.disabled =
          room.phase !== "waiting" ||
          (!available && !members.some((member) => member.id === self));
        header.addEventListener("click", (): void => {
          if (available && Math.floor((me?.playerId ?? -6) / 6) !== team)
            session?.profile({ playerId: team * 6 + available.slot });
        });
        side.append(header);
        for (const position of seats) {
          const id = team * 6 + position.slot;
          const member = room.members.find(
            (candidate) => candidate.playerId === id,
          );
          const seat = document.createElement("button");
          seat.type = "button";
          seat.className = "mp-seat";
          seat.dataset.seat = String(id);
          seat.setAttribute("aria-pressed", String(member?.id === self));
          seat.disabled =
            room.phase !== "waiting" || Boolean(member && member.id !== self);
          const role = document.createElement("span");
          role.textContent = position.name;
          const occupant = document.createElement("strong");
          occupant.textContent = member
            ? `${member.name}${member.id === self ? " · you" : ""}${member.connected ? "" : " · reconnecting"}`
            : "Available";
          seat.append(role, occupant);
          seat.addEventListener("click", (): void =>
            session?.profile({ playerId: id }),
          );
          side.append(seat);
        }
        return side;
      }),
    );
    if (focused)
      teams
        .querySelector<HTMLButtonElement>(`[data-seat="${focused}"]`)
        ?.focus();
    getElement("#mp-start", HTMLButtonElement).hidden = room.hostId !== self;
    getElement("#mp-waiting", HTMLElement).textContent =
      room.hostId === self
        ? "Empty positions are filled by bots."
        : "Waiting for the host to start…";
    getElement("#mp-start", HTMLButtonElement).disabled =
      room.hostId !== self || room.phase !== "waiting";
    setStatus(
      room.phase === "waiting"
        ? "Room ready. Share the code or invite link."
        : "Match connected",
    );
  };
  const open = (
    request: Parameters<typeof connectRoom>[1],
    region = regions.find((r) => r.id === selected),
    rejected?: (message: string) => void,
  ): void => {
    if (!region?.url) {
      setStatus("This location is not configured yet.");
      return;
    }
    leave();
    lock(true);
    latency.textContent = "—";
    badge.dataset.quality = "waiting";
    setStatus("Connecting…");
    session = connectRoom(region, request, {
      room: updateRoom,
      status: setStatus,
      rejected,
      ping: (milliseconds): void => {
        latency.textContent = hosting
          ? "0 ms (Host)"
          : milliseconds === undefined
            ? "—"
            : `${milliseconds} ms`;
        badge.dataset.quality =
          milliseconds === undefined
            ? "waiting"
            : milliseconds < 100
              ? "good"
              : milliseconds < 180
                ? "fair"
                : "poor";
      },
      state: (state): void => {
        if (!started) {
          started = true;
          badge.hidden = false;
          modal.close();
          callbacks.play(state);
        } else callbacks.state(state);
      },
      ended: (): void => {
        session = undefined;
        started = false;
        badge.hidden = true;
        getElement("#mp-setup", HTMLElement).hidden = false;
        modal.classList.remove("mp-lobby");
        getElement("#multiplayer-dialog > header h2", HTMLElement).textContent =
          "Play with friends";
        lock(false);
        getElement("#mp-room", HTMLElement).hidden = true;
        callbacks.ended();
        modal.showModal();
      },
    });
  };
  const joinRoom = (code: string): void => {
    const invite = new URLSearchParams(location.hash.slice(1));
    const preferred = invite.get("region");
    const candidates = regions.filter(
      (region): boolean =>
        Boolean(region.url) && (!preferred || region.id === preferred),
    );
    const tryRegion = (index: number): void => {
      const region = candidates.at(index);
      if (!region) {
        setStatus("Room not found. Check the six-character code.");
        lock(false);
        return;
      }
      selected = region.id;
      open(
        {
          type: "join",
          protocol: PROTOCOL,
          code,
          name: customName,
          handedness: callbacks.handedness(),
        },
        region,
        (message): void => {
          if (/Room not found/i.test(message)) tryRegion(index + 1);
          else {
            setStatus(message);
            lock(false);
          }
        },
      );
    };
    tryRegion(0);
  };
  const ping = async (): Promise<void> => {
    const button = getElement("#mp-ping", HTMLButtonElement);
    button.disabled = true;
    await Promise.all(
      regions
        .filter((r) => r.url)
        .map(async (region) => {
          const output = document.getElementById(`ping-${region.id}`);
          if (!output) return;
          output.textContent = "Checking…";
          try {
            const milliseconds = await measurePing(region);
            pings.set(region.id, milliseconds);
            output.textContent = `${milliseconds} ms`;
            output.dataset.quality =
              milliseconds < 100
                ? "good"
                : milliseconds < 180
                  ? "fair"
                  : "poor";
          } catch {
            output.textContent = "Unavailable";
            output.dataset.quality = "poor";
          }
        }),
    );
    if (!regionChosen && connection === "online") {
      const nearest = [...pings.entries()].sort((a, b) => a[1] - b[1]).at(0);
      if (nearest) selected = nearest[0];
    }
    updateRegion();
    button.disabled = false;
  };
  for (const action of ["create", "join"] as const)
    getElement(`#mp-${action}-tab`, HTMLButtonElement).addEventListener(
      "click",
      (): void => {
        chooseIntent(action);
        if (action === "join") getElement("#mp-code", HTMLInputElement).focus();
      },
    );
  const nameInput = getElement("#mp-name", HTMLInputElement);
  const saveName = (): void => {
    const next = customPlayerName(nameInput.value);
    if (next === customName) {
      nameInput.value = customName ?? assignedName;
      return;
    }
    customName = next;
    nameInput.value = customName ?? "";
    try {
      if (customName) localStorage.setItem("otterpuck-player-name", customName);
      else localStorage.removeItem("otterpuck-player-name");
    } catch {}
    session?.profile({ name: customName ?? "" });
  };
  nameInput.addEventListener("change", saveName);
  nameInput.addEventListener("blur", saveName);
  nameInput.addEventListener("keydown", (event): void => {
    if (event.key === "Enter") nameInput.blur();
  });
  getElement("#mp-code", HTMLInputElement).addEventListener(
    "keydown",
    (event): void => {
      if (event.key === "Enter" && intent === "join")
        getElement("#mp-join", HTMLButtonElement).click();
    },
  );
  getElement("#show-multiplayer", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      modal.showModal();
      void ping();
    },
  );
  getElement("#close-multiplayer", HTMLButtonElement).addEventListener(
    "click",
    (): void => modal.close(),
  );
  getElement("#mp-ping", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      void ping();
    },
  );
  getElement("#mp-create", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      preferredSwimTurn = savedSwimTurn();
      open({
        type: "create",
        protocol: PROTOCOL,
        name: customName,
        handedness: callbacks.handedness(),
        mode: connection,
      });
    },
  );
  getElement("#mp-join", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      const code = getElement("#mp-code", HTMLInputElement)
        .value.trim()
        .toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code)) {
        setStatus("Enter the six-character room code.");
        return;
      }
      joinRoom(code);
    },
  );
  getElement("#mp-start", HTMLButtonElement).addEventListener(
    "click",
    (): void => session?.start(),
  );
  const sizeSelect = getElement("#mp-team-size", HTMLSelectElement);
  sizeSelect.addEventListener("change", (): void => {
    const next = TEAM_SIZES.find(
      (candidate): boolean => String(candidate) === sizeSelect.value,
    );
    if (next) session?.settings({ teamSize: next });
  });
  const swimTurnSelect = getElement("#mp-swim-turn", HTMLSelectElement);
  swimTurnSelect.addEventListener("change", (): void => {
    const next = swimTurnChoice(swimTurnSelect.value);
    if (next === undefined) return;
    saveSwimTurn(next);
    session?.settings({ swimTurn: next });
  });
  const difficultySelect = getElement("#mp-difficulty", HTMLSelectElement);
  difficultySelect.addEventListener("change", (): void => {
    const match = DIFFICULTIES.find(
      ([candidate]): boolean => candidate === difficultySelect.value,
    );
    if (match) session?.settings({ difficulty: match[0] });
  });
  getElement("#mp-leave", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      leave();
      setStatus("");
    },
  );
  getElement("#mp-copy", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      const room = session?.room();
      if (!room) return;
      const url = new URL(location.href);
      url.hash = new URLSearchParams({
        room: room.code,
        region: selected,
        mode: connection,
      }).toString();
      void navigator.clipboard
        .writeText(url.href)
        .then(() => setStatus("Invite copied."))
        .catch(() =>
          setStatus(`Share code ${room.code} and select the same location.`),
        );
    },
  );
  document.addEventListener("visibilitychange", (): void => {
    if (document.hidden) session?.cancelInput();
  });
  window.addEventListener("hashchange", (): void => {
    if (new URLSearchParams(location.hash.slice(1)).has("room"))
      location.reload();
  });
  void loadRegions()
    .then((next) => {
      regions = next;
      selected = regions.find((r) => r.url)?.id ?? "";
      const invite = new URLSearchParams(location.hash.slice(1));
      if (regions.some((r) => r.id === invite.get("region") && r.url)) {
        selected = invite.get("region") ?? selected;
        regionChosen = true;
      }
      regionList.replaceChildren();
      const legend = document.createElement("legend");
      legend.textContent = "Server region";
      legend.className = "mp-sr-only";
      regionList.append(legend);
      for (const region of regions) {
        const label = document.createElement("label");
        label.className = "mp-region";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "mp-region";
        radio.value = region.id;
        radio.checked = region.id === selected;
        radio.disabled = !region.url;
        radio.addEventListener("change", (): void => {
          selected = region.id;
          regionChosen = true;
          connection = "online";
          updateRegion();
          getElement("#mp-region-picker", HTMLDetailsElement).open = false;
        });
        const name = document.createElement("span");
        name.textContent = region.label;
        const latency = document.createElement("output");
        latency.id = `ping-${region.id}`;
        latency.textContent = region.url ? "—" : "Unavailable";
        label.append(radio, name, latency);
        regionList.append(label);
      }
      const lanLabel = document.createElement("label");
      lanLabel.className = "mp-region";
      const lanRadio = document.createElement("input");
      lanRadio.type = "radio";
      lanRadio.name = "mp-region";
      lanRadio.value = "lan";
      lanRadio.disabled = !regions.some(
        (region) => region.id === "us" && region.url,
      );
      lanRadio.addEventListener("change", (): void => {
        connection = "lan";
        regionChosen = true;
        selected = "us";
        updateRegion();
        getElement("#mp-region-picker", HTMLDetailsElement).open = false;
      });
      const lanName = document.createElement("span");
      lanName.textContent = "Local Network";
      lanLabel.append(lanRadio, lanName);
      regionList.append(lanLabel);
      if (invite.get("mode") === "lan") {
        connection = "lan";
        for (const input of regionList.querySelectorAll("input"))
          input.checked = input.value === "lan";
      }
      updateRegion();
      if (invite.has("room")) {
        chooseIntent("join");
        getElement("#mp-code", HTMLInputElement).value =
          invite.get("room") ?? "";
        modal.showModal();
        void ping();
      }
      let saved: unknown;
      try {
        saved = JSON.parse(sessionStorage.getItem("otterpuck-room") ?? "null");
      } catch {}
      const resume = z
        .object({
          region: z.string(),
          code: z.string(),
          token: z.string().uuid(),
        })
        .safeParse(saved);
      if (
        resume.success &&
        regions.some((r) => r.id === resume.data.region && r.url) &&
        (!invite.has("room") ||
          (invite.get("room") === resume.data.code &&
            invite.get("region") === resume.data.region))
      ) {
        selected = resume.data.region;
        open({
          type: "resume",
          protocol: PROTOCOL,
          code: resume.data.code,
          token: resume.data.token,
        });
      }
    })
    .catch(() =>
      setStatus("Could not load server locations. Reload to retry."),
    );
  return {
    active: () => Boolean(session),
    handedness: (value): void => session?.profile({ handedness: value }),
    input: (controls, seconds): void => session?.input(controls, seconds),
    cancelInput: (): void => session?.cancelInput(),
    frame: (): void => session?.frame(),
    alpha: (): number => session?.alpha() ?? 1,
    leave,
  };
};
