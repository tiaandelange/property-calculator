-- Applicant form: additional occupants select + pets (cats/dogs) section

CREATE OR REPLACE FUNCTION public.default_applicant_form_template ()
  RETURNS jsonb
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT jsonb_build_object(
    'title', 'Rental application',
    'description', 'Please complete all required fields. Your information is shared only with the property owner.',
    'allowCoApplicant', true,
    'fields', jsonb_build_array(
      jsonb_build_object('id', 'firstName', 'label', 'First name', 'type', 'text', 'required', true, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'lastName', 'label', 'Surname', 'type', 'text', 'required', true, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'idNumber', 'label', 'ID number', 'type', 'text', 'required', false, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'phone', 'label', 'Contact number', 'type', 'phone', 'required', false, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'email', 'label', 'Email address', 'type', 'email', 'required', true, 'width', 'full', 'system', true),
      jsonb_build_object('id', 'monthlyIncome', 'label', 'Monthly income (after tax)', 'type', 'income', 'required', true, 'width', 'full', 'system', true),
      jsonb_build_object(
        'id', 'additionalOccupants',
        'label', 'How many additional people will be living at the property?',
        'type', 'select',
        'required', false,
        'width', 'full',
        'system', true,
        'options', jsonb_build_array('1', '2', '3', '4', '5')
      ),
      jsonb_build_object('id', 'previousResidency', 'label', 'Previous residency', 'type', 'text', 'required', false, 'width', 'full', 'system', true),
      jsonb_build_object('id', 'landlordContact', 'label', 'Landlord contact details', 'type', 'text', 'required', false, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'timeRented', 'label', 'Time rented', 'type', 'text', 'required', false, 'width', 'half', 'placeholder', 'e.g. 2 years', 'system', true),
      jsonb_build_object('id', 'animals', 'label', 'Pets', 'type', 'animals', 'required', false, 'width', 'full', 'system', true)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_applicant_form_template (p_template jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
DECLARE
  v_fields jsonb := coalesce(p_template -> 'fields', '[]'::jsonb);
  v_out jsonb := '[]'::jsonb;
  v_field jsonb;
  v_id text;
  v_type text;
  v_seen text[] := ARRAY[]::text[];
  v_required_system text[] := ARRAY['firstName', 'lastName', 'email', 'monthlyIncome'];
  v_sys text;
  v_has_additional boolean := false;
  v_has_animals boolean := false;
  v_merged jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_inserted_additional boolean := false;
  v_inserted_animals boolean := false;
BEGIN
  IF jsonb_typeof(v_fields) <> 'array' THEN
    RETURN public.default_applicant_form_template();
  END IF;

  FOR v_field IN SELECT value FROM jsonb_array_elements(v_fields) LOOP
    v_id := trim(coalesce(v_field ->> 'id', ''));
    IF v_id = '' OR v_id = ANY (v_seen) THEN
      CONTINUE;
    END IF;
    v_type := coalesce(v_field ->> 'type', 'text');
    IF v_type NOT IN ('text', 'email', 'phone', 'income', 'select', 'animals') THEN
      v_type := 'text';
    END IF;
    v_out := v_out || jsonb_build_array(
      CASE
        WHEN v_id = 'additionalOccupants' THEN
          jsonb_build_object(
            'id', 'additionalOccupants',
            'label', coalesce(nullif(trim(v_field ->> 'label'), ''), 'How many additional people will be living at the property?'),
            'type', 'select',
            'required', coalesce((v_field ->> 'required')::boolean, false),
            'width', 'full',
            'system', true,
            'options', coalesce(v_field -> 'options', jsonb_build_array('1', '2', '3', '4', '5'))
          )
        WHEN v_id = 'animals' THEN
          jsonb_build_object(
            'id', 'animals',
            'label', coalesce(nullif(trim(v_field ->> 'label'), ''), 'Pets'),
            'type', 'animals',
            'required', coalesce((v_field ->> 'required')::boolean, false),
            'width', 'full',
            'system', true
          )
        ELSE
          jsonb_build_object(
            'id', v_id,
            'label', coalesce(nullif(trim(v_field ->> 'label'), ''), v_id),
            'type', v_type,
            'required', coalesce((v_field ->> 'required')::boolean, false),
            'width', CASE WHEN coalesce(v_field ->> 'width', 'full') = 'half' THEN 'half' ELSE 'full' END,
            'placeholder', nullif(trim(coalesce(v_field ->> 'placeholder', '')), ''),
            'system', coalesce((v_field ->> 'system')::boolean, false)
          )
      END
    );
    v_seen := array_append(v_seen, v_id);
    IF v_id = 'additionalOccupants' THEN
      v_has_additional := true;
    END IF;
    IF v_id = 'animals' THEN
      v_has_animals := true;
    END IF;
  END LOOP;

  FOREACH v_sys IN ARRAY v_required_system LOOP
    IF NOT (v_sys = ANY (v_seen)) THEN
      RETURN public.default_applicant_form_template();
    END IF;
  END LOOP;

  IF jsonb_array_length(v_out) = 0 THEN
    RETURN public.default_applicant_form_template();
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_out) LOOP
    v_merged := v_merged || jsonb_build_array(v_elem);
    IF NOT v_has_additional AND NOT v_inserted_additional AND (v_elem ->> 'id') = 'monthlyIncome' THEN
      v_merged := v_merged || jsonb_build_array(
        jsonb_build_object(
          'id', 'additionalOccupants',
          'label', 'How many additional people will be living at the property?',
          'type', 'select',
          'required', false,
          'width', 'full',
          'system', true,
          'options', jsonb_build_array('1', '2', '3', '4', '5')
        )
      );
      v_inserted_additional := true;
    END IF;
    IF NOT v_has_animals AND NOT v_inserted_animals AND (v_elem ->> 'id') = 'timeRented' THEN
      v_merged := v_merged || jsonb_build_array(
        jsonb_build_object(
          'id', 'animals',
          'label', 'Pets',
          'type', 'animals',
          'required', false,
          'width', 'full',
          'system', true
        )
      );
      v_inserted_animals := true;
    END IF;
  END LOOP;

  IF NOT v_has_additional AND NOT v_inserted_additional THEN
    v_merged := v_merged || jsonb_build_array(
      jsonb_build_object(
        'id', 'additionalOccupants',
        'label', 'How many additional people will be living at the property?',
        'type', 'select',
        'required', false,
        'width', 'full',
        'system', true,
        'options', jsonb_build_array('1', '2', '3', '4', '5')
      )
    );
  END IF;

  IF NOT v_has_animals AND NOT v_inserted_animals THEN
    v_merged := v_merged || jsonb_build_array(
      jsonb_build_object(
        'id', 'animals',
        'label', 'Pets',
        'type', 'animals',
        'required', false,
        'width', 'full',
        'system', true
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'title', coalesce(nullif(trim(p_template ->> 'title'), ''), 'Rental application'),
    'description', coalesce(p_template ->> 'description', ''),
    'allowCoApplicant', coalesce((p_template ->> 'allowCoApplicant')::boolean, true),
    'fields', v_merged
  );
END;
$$;
