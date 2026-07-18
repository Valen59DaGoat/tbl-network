// ============================================
// TBL shared app logic
// Requires config.js and the Supabase CDN script
// to be loaded BEFORE this file on every page.
// ============================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function pct(w, l){
  const g = w + l;
  return g === 0 ? ".000" : (w / g).toFixed(3).replace(/^0/, "");
}

function escapeHtml(str){
  return (str || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

// ---------- PUBLIC PAGE RENDERERS ----------

async function loadTeamsSorted(){
  const { data, error } = await sb.from("teams").select("*");
  if (error || !data) return [];
  return data.sort((a, b) => {
    const pa = a.wins / Math.max(a.wins + a.losses, 1);
    const pb = b.wins / Math.max(b.wins + b.losses, 1);
    return pb - pa;
  });
}

async function buildLogoMap(){
  const { data } = await sb.from("teams").select("name, abbr, logo_url");
  const map = {};
  (data || []).forEach(t => {
    if (t.logo_url){
      if (t.name) map[t.name.toLowerCase()] = t.logo_url;
      if (t.abbr) map[t.abbr.toLowerCase()] = t.logo_url;
    }
  });
  return map;
}

function logoImg(url, alt, size){
  if (!url) return "";
  const s = size || 50; // increased default logo size
  return `<img src="${url}" alt="${escapeHtml(alt || "")}" class="team-logo" style="width:${s}px;height:${s}px;">`;
}

async function renderHomeScoreboard(){
  const el = document.getElementById("home-scorepanel");
  if (!el) return;

  const { data } = await sb.from("games")
    .select("*")
    .order("game_date", { ascending: true });

  const upcoming = (data || []).find(g => g.status !== "final") || (data || [])[0];

  if (!upcoming){
    el.innerHTML = `<div class="label">Game Center</div><p>No games on the schedule yet. Check back soon.</p>`;
    return;
  }

  const isFinal = upcoming.status === "final";
  const logos = await buildLogoMap();

  const awayLogo = logos[(upcoming.away_team || "").toLowerCase()];
  const homeLogo = logos[(upcoming.home_team || "").toLowerCase()];

  el.innerHTML = `
    <div class="label">${isFinal ? "Final" : "Next Up"} · Week ${upcoming.week ?? "-"}</div>
    <div class="matchup">
      <div class="team-slot">
        ${logoImg(awayLogo, upcoming.away_team, 130)}
        <div class="abbr">${escapeHtml(upcoming.away_team)}</div>
        <div class="record">${isFinal ? upcoming.away_score : ""}</div>
      </div>
      <div class="vs">${isFinal ? "FINAL" : upcoming.game_date || "TBD"}</div>
      <div class="team-slot">
        ${logoImg(homeLogo, upcoming.home_team, 130)}
        <div class="abbr">${escapeHtml(upcoming.home_team)}</div>
        <div class="record">${isFinal ? upcoming.home_score : ""}</div>
      </div>
    </div>`;
}

async function renderStandings(){
  const el = document.getElementById("standings-body");
  if (!el) return;

  const teams = await loadTeamsSorted();

  if (teams.length === 0){
    el.innerHTML = `<tr><td colspan="5">No teams added yet.</td></tr>`;
    return;
  }

  el.innerHTML = teams.map(t => `
    <tr>
      <td class="team-name">${logoImg(t.logo_url, t.name, 40)} ${escapeHtml(t.name)} <span style="opacity:.55">(${escapeHtml(t.abbr)})</span></td>
      <td class="num">${t.wins}</td>
      <td class="num">${t.losses}</td>
      <td class="num">${pct(t.wins, t.losses)}</td>
    </tr>`).join("");
}
async function renderSchedule(){
  const el = document.getElementById("schedule-body");
  if (!el) return;

  const { data, error } = await sb.from("games")
    .select("*")
    .order("week", { ascending: true });

  if (error || !data || data.length === 0){
    el.innerHTML = `<tr><td colspan="5">No games scheduled yet.</td></tr>`;
    return;
  }

  const logos = await buildLogoMap();

  el.innerHTML = data.map(g => `
    <tr>
      <td class="num">${g.week ?? "-"}</td>
      <td>${g.game_date || "TBD"}</td>
      <td>
        ${logoImg(logos[(g.away_team||"").toLowerCase()], g.away_team, 35)}
        ${escapeHtml(g.away_team)}
        @
        ${logoImg(logos[(g.home_team||"").toLowerCase()], g.home_team, 35)}
        ${escapeHtml(g.home_team)}
      </td>
      <td>${g.status === "final" ? `${g.away_score} – ${g.home_score}` : "—"}</td>
      <td>${escapeHtml(g.status || "scheduled")}</td>
    </tr>`).join("");
}

async function renderTeams(){
  const el = document.getElementById("teams-list");
  if (!el) return;

  const teams = await loadTeamsSorted();

  if (teams.length === 0){
    el.innerHTML = `<p>No teams added yet.</p>`;
    return;
  }

  el.innerHTML = teams.map(t => `
    <div class="card">
      <h3>${logoImg(t.logo_url, t.name, 60)} ${escapeHtml(t.name)} <span style="opacity:.5">${escapeHtml(t.abbr)}</span></h3>
      <p style="font-family:var(--mono); font-size:.85rem; opacity:.7;">${t.wins}-${t.losses} · ${pct(t.wins, t.losses)}</p>
      ${t.blurb ? `<p>${escapeHtml(t.blurb)}</p>` : ""}
    </div>`).join("");
}

async function renderRankings(){
  const el = document.getElementById("rankings-list");
  if (!el) return;

  const { data, error } = await sb.from("rankings").select("*").order("rank", { ascending: true });

  if (error || !data || data.length === 0){
    el.innerHTML = `<p>Rankings haven't been posted yet.</p>`;
    return;
  }

  const logos = await buildLogoMap();

  el.innerHTML = data.map(r => `
    <div class="card">
      <h3>
        <span class="rank-badge">#${r.rank}</span>
        ${logoImg(logos[(r.team||"").toLowerCase()], r.team, 50)}
        ${escapeHtml(r.team)}
      </h3>
      ${r.note ? `<p>${escapeHtml(r.note)}</p>` : ""}
    </div>`).join("");
}

async function renderRules(){
  const el = document.getElementById("rules-list");
  if (!el) return;

  const { data, error } = await sb.from("rules").select("*").order("sort_order", { ascending: true });

  if (error || !data || data.length === 0){
    el.innerHTML = `<p>Rules haven't been posted yet.</p>`;
    return;
  }

  el.innerHTML = data.map(r => `
    <div class="card">
      <h3>${escapeHtml(r.title)}</h3>
      <p>${escapeHtml(r.body)}</p>
    </div>`).join("");
}


// ---------- AUTH ----------

async function handleLogin(e){
  e.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const msgEl = document.getElementById("login-msg");

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error){
    msgEl.textContent = "Login failed: " + error.message;
    msgEl.className = "msg error";
    return;
  }

  window.location.href = "dashboard.html";
}

async function requireAuth(){
  const { data } = await sb.auth.getSession();

  if (!data.session){
    window.location.href = "login.html";
    return null;
  }

  return data.session;
}

async function handleLogout(){
  await sb.auth.signOut();
  window.location.href = "login.html";
}
// ---------- DASHBOARD: TEAMS ----------

async function dashLoadTeams(){
  const el = document.getElementById("dash-teams-list");
  const teams = await loadTeamsSorted();

  el.innerHTML = teams.map(t => `
    <div class="list-row">
      <span>${escapeHtml(t.name)} (${escapeHtml(t.abbr)}) — ${t.wins}-${t.losses}</span>
      <span class="actions">
        <button onclick="dashEditTeam('${t.id}')">Edit</button>
        <button class="danger" onclick="dashDeleteTeam('${t.id}')">Delete</button>
      </span>
    </div>`).join("") || "<p>No teams yet.</p>";
}

async function dashAddOrUpdateTeam(e){
  e.preventDefault();

  const id = document.getElementById("team-id").value;

  const payload = {
    name: document.getElementById("team-name").value.trim(),
    abbr: document.getElementById("team-abbr").value.trim().toUpperCase(),
    wins: parseInt(document.getElementById("team-wins").value || "0", 10),
    losses: parseInt(document.getElementById("team-losses").value || "0", 10),
    blurb: document.getElementById("team-blurb").value.trim(),
    logo_url: document.getElementById("team-logo").value.trim(),
  };

  const msgEl = document.getElementById("team-msg");

  const { error } = id
    ? await sb.from("teams").update(payload).eq("id", id)
    : await sb.from("teams").insert(payload);

  msgEl.textContent = error ? "Error: " + error.message : "Saved.";
  msgEl.className = error ? "msg error" : "msg ok";

  if (!error){
    document.getElementById("team-form").reset();
    document.getElementById("team-id").value = "";
    dashLoadTeams();
  }
}

async function dashEditTeam(id){
  const { data } = await sb.from("teams").select("*").eq("id", id).single();

  if (!data) return;

  document.getElementById("team-id").value = data.id;
  document.getElementById("team-name").value = data.name;
  document.getElementById("team-abbr").value = data.abbr;
  document.getElementById("team-wins").value = data.wins;
  document.getElementById("team-losses").value = data.losses;
  document.getElementById("team-blurb").value = data.blurb || "";
  document.getElementById("team-logo").value = data.logo_url || "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function dashDeleteTeam(id){
  if (!confirm("Delete this team?")) return;

  await sb.from("teams").delete().eq("id", id);
  dashLoadTeams();
}


// ---------- DASHBOARD: GAMES ----------

async function dashLoadGames(){
  const el = document.getElementById("dash-games-list");

  const { data } = await sb.from("games")
    .select("*")
    .order("week", { ascending: true });

  el.innerHTML = (data || []).map(g => `
    <div class="list-row">
      <span>Wk ${g.week ?? "-"}: ${escapeHtml(g.away_team)} @ ${escapeHtml(g.home_team)} — ${g.status}</span>
      <span class="actions">
        <button onclick="dashEditGame('${g.id}')">Edit</button>
        <button class="danger" onclick="dashDeleteGame('${g.id}')">Delete</button>
      </span>
    </div>`).join("") || "<p>No games yet.</p>";
}

async function dashAddOrUpdateGame(e){
  e.preventDefault();

  const id = document.getElementById("game-id").value;

  const payload = {
    week: parseInt(document.getElementById("game-week").value || "0", 10),
    game_date: document.getElementById("game-date").value || null,
    home_team: document.getElementById("game-home").value.trim(),
    away_team: document.getElementById("game-away").value.trim(),
    home_score: document.getElementById("game-home-score").value === "" ? null : parseInt(document.getElementById("game-home-score").value, 10),
    away_score: document.getElementById("game-away-score").value === "" ? null : parseInt(document.getElementById("game-away-score").value, 10),
    status: document.getElementById("game-status").value,
  };

  const msgEl = document.getElementById("game-msg");

  const { error } = id
    ? await sb.from("games").update(payload).eq("id", id)
    : await sb.from("games").insert(payload);

  msgEl.textContent = error ? "Error: " + error.message : "Saved.";
  msgEl.className = error ? "msg error" : "msg ok";

  if (!error){
    document.getElementById("game-form").reset();
    document.getElementById("game-id").value = "";
    dashLoadGames();
  }
}

async function dashEditGame(id){
  const { data } = await sb.from("games").select("*").eq("id", id).single();

  if (!data) return;

  document.getElementById("game-id").value = data.id;
  document.getElementById("game-week").value = data.week ?? "";
  document.getElementById("game-date").value = data.game_date ?? "";
  document.getElementById("game-home").value = data.home_team ?? "";
  document.getElementById("game-away").value = data.away_team ?? "";
  document.getElementById("game-home-score").value = data.home_score ?? "";
  document.getElementById("game-away-score").value = data.away_score ?? "";
  document.getElementById("game-status").value = data.status ?? "scheduled";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function dashDeleteGame(id){
  if (!confirm("Delete this game?")) return;

  await sb.from("games").delete().eq("id", id);
  dashLoadGames();
}


// ---------- DASHBOARD TABS ----------

function showDashTab(name){
  document.querySelectorAll(".dash-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".dash-tabs button").forEach(b => b.classList.remove("active"));

  document.getElementById("tab-" + name).classList.add("active");
  document.getElementById("btn-" + name).classList.add("active");
}
