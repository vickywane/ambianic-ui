<template>
  <v-row
    align="start"
    justify="space-around"
  >
    <v-col
      style="max-width: 400px;"
      align="center"
      justify="center"
      cols="12"
      class="pa-0 ma-0 fill-height"
    >
      <v-card
        class="mx-auto text-left"
      >
        <v-list
          three-line
        >
          <amb-list-item
            id="feedback-title"
            icon-name="comment-quote-outline"
            title="Send Feedback"
            subtitle="We currently use github to gather user feedbaack. Click the button below to open an issue."
          />
        </v-list>
        <v-card-actions>
          <v-btn
            id="btn-feedback"
            text
            href="https://github.com/ambianic/ambianic-ui/issues"
            target="_blank"
          >
            Open Feedback Page
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>
<script>
import AmbListItem from '@/components/shared/ListItem.vue'

export default {
  components: {
    AmbListItem
  }
}
</script>
