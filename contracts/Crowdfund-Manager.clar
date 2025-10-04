(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-GOAL u101)
(define-constant ERR-INVALID-DEADLINE u102)
(define-constant ERR-INVALID-NFT-ID u103)
(define-constant ERR-CAMPAIGN-EXISTS u104)
(define-constant ERR-CAMPAIGN-NOT-FOUND u105)
(define-constant ERR-INVALID-CONTRIB u106)
(define-constant ERR-DEADLINE-PASSED u107)
(define-constant ERR-GOAL-NOT-MET u108)
(define-constant ERR-GOAL-MET u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant ERR-REFUND-FAILED u111)
(define-constant ERR-TRANSFER-FAILED u112)
(define-constant ERR-INVALID-DESCRIPTION u113)
(define-constant ERR-INVALID-TITLE u114)
(define-constant ERR-MAX-CAMPAIGNS-EXCEEDED u115)
(define-constant ERR-INVALID-MIN-CONTRIB u116)
(define-constant ERR-INVALID-MAX-CONTRIB u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-MILESTONES u119)
(define-constant ERR-INVALID-ESCROW u120)
(define-constant ERR-INVALID-ORACLE u121)

(define-data-var next-campaign-id uint u0)
(define-data-var max-campaigns uint u500)
(define-data-var creation-fee uint u500)
(define-data-var escrow-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var oracle-contract principal 'SP000000000000000000002Q6VF78)

(define-map campaigns
  uint
  {
    nft-id: uint,
    title: (string-utf8 100),
    description: (string-utf8 500),
    goal: uint,
    raised: uint,
    deadline: uint,
    creator: principal,
    status: uint,
    location: (string-utf8 100),
    min-contrib: uint,
    max-contrib: uint,
    milestones: uint
  }
)

(define-map contributions
  {campaign-id: uint, contributor: principal}
  uint
)

(define-map campaigns-by-nft
  uint
  uint
)

(define-read-only (get-campaign (id uint))
  (map-get? campaigns id)
)

(define-read-only (get-contribution (campaign-id uint) (contributor principal))
  (map-get? contributions {campaign-id: campaign-id, contributor: contributor})
)

(define-read-only (get-campaign-by-nft (nft-id uint))
  (map-get? campaigns-by-nft nft-id)
)

(define-private (validate-title (title (string-utf8 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-goal (goal uint))
  (if (> goal u0)
      (ok true)
      (err ERR-INVALID-GOAL))
)

(define-private (validate-deadline (deadline uint))
  (if (> deadline block-height)
      (ok true)
      (err ERR-INVALID-DEADLINE))
)

(define-private (validate-nft-id (nft-id uint))
  (if (> nft-id u0)
      (ok true)
      (err ERR-INVALID-NFT-ID))
)

(define-private (validate-contrib (amount uint) (min uint) (max uint))
  (if (and (>= amount min) (<= amount max))
      (ok true)
      (err ERR-INVALID-CONTRIB))
)

(define-private (validate-min-contrib (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-CONTRIB))
)

(define-private (validate-max-contrib (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-CONTRIB))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-milestones (miles uint))
  (if (and (> miles u0) (<= miles u10))
      (ok true)
      (err ERR-INVALID-MILESTONES))
)

(define-public (set-escrow-contract (new-escrow principal))
  (begin
    (asserts! (is-eq tx-sender (as-contract tx-sender)) (err ERR-NOT-AUTHORIZED))
    (var-set escrow-contract new-escrow)
    (ok true)
  )
)

(define-public (set-oracle-contract (new-oracle principal))
  (begin
    (asserts! (is-eq tx-sender (as-contract tx-sender)) (err ERR-NOT-AUTHORIZED))
    (var-set oracle-contract new-oracle)
    (ok true)
  )
)

(define-public (set-max-campaigns (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (as-contract tx-sender)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set max-campaigns new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (as-contract tx-sender)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (start-campaign
  (nft-id uint)
  (title (string-utf8 100))
  (description (string-utf8 500))
  (goal uint)
  (deadline uint)
  (location (string-utf8 100))
  (min-contrib uint)
  (max-contrib uint)
  (milestones uint)
)
  (let (
        (next-id (var-get next-campaign-id))
        (current-max (var-get max-campaigns))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-CAMPAIGNS-EXCEEDED))
    (try! (validate-nft-id nft-id))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-goal goal))
    (try! (validate-deadline deadline))
    (try! (validate-location location))
    (try! (validate-min-contrib min-contrib))
    (try! (validate-max-contrib max-contrib))
    (try! (validate-milestones milestones))
    (asserts! (is-none (map-get? campaigns-by-nft nft-id)) (err ERR-CAMPAIGN-EXISTS))
    (try! (stx-transfer? (var-get creation-fee) tx-sender (as-contract tx-sender)))
    (map-set campaigns next-id
      {
        nft-id: nft-id,
        title: title,
        description: description,
        goal: goal,
        raised: u0,
        deadline: deadline,
        creator: tx-sender,
        status: u0,
        location: location,
        min-contrib: min-contrib,
        max-contrib: max-contrib,
        milestones: milestones
      }
    )
    (map-set campaigns-by-nft nft-id next-id)
    (var-set next-campaign-id (+ next-id u1))
    (print { event: "campaign-started", id: next-id })
    (ok next-id)
  )
)

(define-public (contribute (campaign-id uint) (amount uint))
  (let ((campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-CAMPAIGN-NOT-FOUND))))
    (asserts! (< block-height (get deadline campaign)) (err ERR-DEADLINE-PASSED))
    (asserts! (is-eq (get status campaign) u0) (err ERR-INVALID-STATUS))
    (try! (validate-contrib amount (get min-contrib campaign) (get max-contrib campaign)))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (let (
          (current-raised (get raised campaign))
          (new-raised (+ current-raised amount))
          (current-contrib (default-to u0 (map-get? contributions {campaign-id: campaign-id, contributor: tx-sender})))
          (new-contrib (+ current-contrib amount))
        )
      (map-set campaigns campaign-id (merge campaign { raised: new-raised }))
      (map-set contributions {campaign-id: campaign-id, contributor: tx-sender} new-contrib)
      (print { event: "contribution-made", campaign-id: campaign-id, amount: amount })
      (ok amount)
    )
  )
)

(define-public (finalize-campaign (campaign-id uint))
  (let ((campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-CAMPAIGN-NOT-FOUND))))
    (asserts! (>= block-height (get deadline campaign)) (err ERR-DEADLINE-PASSED))
    (asserts! (is-eq (get status campaign) u0) (err ERR-INVALID-STATUS))
    (asserts! (is-eq tx-sender (get creator campaign)) (err ERR-NOT-AUTHORIZED))
    (if (>= (get raised campaign) (get goal campaign))
        (begin
          (try! (as-contract (stx-transfer? (get raised campaign) tx-sender (var-get escrow-contract))))
          (map-set campaigns campaign-id (merge campaign { status: u1 }))
          (print { event: "campaign-success", id: campaign-id })
          (ok true)
        )
        (begin
          (map-set campaigns campaign-id (merge campaign { status: u2 }))
          (print { event: "campaign-failed", id: campaign-id })
          (ok false)
        )
    )
  )
)

(define-public (refund (campaign-id uint))
  (let ((campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-CAMPAIGN-NOT-FOUND))))
    (asserts! (is-eq (get status campaign) u2) (err ERR-INVALID-STATUS))
    (let ((contrib (unwrap! (map-get? contributions {campaign-id: campaign-id, contributor: tx-sender}) (err ERR-INVALID-CONTRIB))))
      (asserts! (> contrib u0) (err ERR-INVALID-CONTRIB))
      (try! (as-contract (stx-transfer? contrib tx-sender tx-sender)))
      (map-delete contributions {campaign-id: campaign-id, contributor: tx-sender})
      (print { event: "refund-issued", campaign-id: campaign-id, amount: contrib })
      (ok contrib)
    )
  )
)

(define-public (get-campaign-count)
  (ok (var-get next-campaign-id))
)

(define-public (check-campaign-existence (nft-id uint))
  (ok (is-some (map-get? campaigns-by-nft nft-id)))
)