function handleBeforeSend(event) {
    const textArea = event.target.querySelector("textarea")
    const button = event.target.querySelector("input[type='submit']")

    textArea.disabled = true
    button.disabled = true
  }
