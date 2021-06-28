const routes = [
  {
    path: '/',
    name: 'home',
    // component: Home
    component: () => import(/* webpackChunkName: "home" */ '../views/Home.vue')
  },
  {
    path: '/index.html',
    name: 'pwahome',
    component: () => import(/* webpackChunkName: "home" */ '../views/Home.vue') // Fix for PWA at /index.html
  },
  {
    path: '/timeline',
    name: 'timeline',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "timeline" */ '../views/Timeline.vue')
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "onboarding" */ '../views/Onboarding.vue')
  },
  // {
  // This might be connected again once we have better UX design
  //   path: '/edge-connect',
  //   name: 'edge-connect',
  //   props: true,
  //     route level code-splitting
  //     this generates a separate chunk (about.[hash].js) for this route
  //     which is lazy-loaded when the route is visited.
  //   component: () => import(/* webpackChunkName: "edge-connect" */ '../views/EdgeConnect.vue')
  // },
  {
    path: '/settings',
    name: 'settings',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "settings" */ '../views/Settings.vue')
  },
  {
    path: '/feedback',
    name: 'feedback',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "feedback" */ '../views/Feedback.vue')
  },
  {
    path: '/help',
    name: 'help',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "help" */ '../views/Help.vue')
  },
  {
    path: '/about',
    name: 'about',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/About.vue')
  }
]

export default routes
