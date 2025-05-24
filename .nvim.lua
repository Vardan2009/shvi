vim.api.nvim_create_autocmd({"BufRead", "BufNewFile"}, {
  pattern = "*.shvi",
  callback = function()
    vim.bo.filetype = "lisp"
  end
})

