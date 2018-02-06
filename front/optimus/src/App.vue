<template>
  <div id="app">
    <b-navbar toggleable="md" type="dark" variant="info">
      <b-navbar-toggle target="nav_collapse"></b-navbar-toggle>
      <b-navbar-brand href="#">Optimus</b-navbar-brand>
      <b-navbar-nav>
        <b-nav-item :to="{name: 'HelloWorld'}">Home</b-nav-item>
        <b-nav-item :to="{name: 'releases'}">Releases</b-nav-item>
        <b-nav-item :to="{name: 'epics'}">Epics</b-nav-item>
      </b-navbar-nav>
    </b-navbar>
    <b-container class="main">
      <b-row>
          <router-view/>
      </b-row>
    </b-container>
  </div>
</template>

<script>
  export default {
    name: 'app'
  }
</script>

<style>
.main {
  margin-top: 4em;
}
</style>
