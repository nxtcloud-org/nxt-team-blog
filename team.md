---
layout: default
title: 팀 소개
description: NXT 팀을 만나보세요.
permalink: /team/
---
<div class="team-page">
  <div class="container">
    <div class="page-header">
      <h1>팀을 소개합니다</h1>
      <p class="page-description">다양한 배경과 전문성을 가진 NXT 팀원들입니다.</p>
    </div>

    <div class="team-full-grid">
      {% for author in site.authors %}
      <a href="{{ author.url | relative_url }}" class="team-card">
        <div class="team-avatar" style="background: {{ author.color | default: '#6366f1' }}">{{ author.name | slice: 0 }}</div>
        <h3>{{ author.name }}</h3>
        <p class="team-role">{{ author.role }}</p>
        <p class="team-bio">{{ author.bio | truncate: 100 }}</p>
        <div class="team-tags">
          {% for skill in author.skills limit: 4 %}
          <span class="skill-tag">{{ skill }}</span>
          {% endfor %}
        </div>
      </a>
      {% endfor %}
    </div>
  </div>
</div>
