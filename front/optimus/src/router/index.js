import Vue from 'vue'
import Router from 'vue-router'
import HelloWorld from '@/components/HelloWorld'
import video from '@/components/Video'
import ongoing from '@/components/Current'
import releases from '@/components/Release'
Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'HelloWorld',
      component: HelloWorld
    },
    {
      path: '/video',
      name: 'video',
      component: video
    },
    {
      path: '/ongoing',
      name: 'ongoing',
      component: ongoing
    },
    {
      path: '/releases',
      name: 'releases',
      component: releases
    }
  ]
})
