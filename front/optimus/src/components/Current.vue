<template>
    <b-table striped hover :items="items" :fields="fields"></b-table>
</template>
<script>
  export default {
    data () {
      return {
        // Note 'isActive' is left out and will not appear in the rendered table
        fields: {
          last_name: {
            label: 'Person last name',
            sortable: true
          },
          first_name: {
            label: 'Person first name',
            sortable: false
          },
          foo: {
            // This key overrides `foo`!
            key: 'age',
            label: 'Person age',
            sortable: true
          }
        },
        items: [
          { isActive: true, age: 40, first_name: 'Dickerson', last_name: 'Macdonald' },
          { isActive: false, age: 21, first_name: 'Larsen', last_name: 'Shaw' },
          { isActive: false, age: 89, first_name: 'Geneva', last_name: 'Wilson' },
          { isActive: true, age: 38, first_name: 'Jami', last_name: 'Carney' }
        ]
      }
    }
  }
</script>
